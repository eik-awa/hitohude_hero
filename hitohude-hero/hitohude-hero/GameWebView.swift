//
//  GameWebView.swift
//  hitohude-hero
//
//  バンドル内の index.html / rules.js / app.js(ゲーム本体)を WKWebView で動かす。
//  ファイルはカスタム URL スキーム(hhapp://)経由でバンドルから配信するので、通信なしで遊べる。
//  ゲーム側(JS)とは window.webkit.messageHandlers.<名前> でやりとりする:
//    appReady / settings / openURL / requestReview / rewardAd / interstitial / privacy / progress / haptic
//  ネイティブ → JS は window.__onRewardAdResult__ / window.__setConsentApplicable__ を呼ぶ。
//

import SwiftUI
import WebKit
import StoreKit
import UIKit
import AVFoundation

extension Color {
    /// ゲームの背景色(苔の洞窟)。スプラッシュ・広告枠の下地にも使う。
    static let hhBackground = Color(red: 13 / 255, green: 28 / 255, blue: 26 / 255)
}
extension UIColor {
    static let hhBackground = UIColor(red: 13 / 255, green: 28 / 255, blue: 26 / 255, alpha: 1)
}

struct GameWebView: UIViewRepresentable {
    static let scheme = "hhapp"
    static let startURL = URL(string: "\(scheme)://app/index.html")!

    /// ゲームの初回描画が終わったときに呼ばれる(スプラッシュを消す)。
    var onReady: (() -> Void)?

    func makeCoordinator() -> Coordinator { Coordinator(onReady: onReady) }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = [] // 効果音・BGM(Web Audio)をタップ前から鳴らせるように
        config.setURLSchemeHandler(GameSchemeHandler(), forURLScheme: Self.scheme)

        // アプリのバージョンをゲーム側(設定画面の表示)へ渡す
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
        config.userContentController.addUserScript(WKUserScript(
            source: "window.hhAppVersion = \"\(version)\";", injectionTime: .atDocumentStart, forMainFrameOnly: true))

        // JS → Swift (retain cycle 回避のためプロキシ経由)
        let proxy = WeakScriptMessageProxy(target: context.coordinator)
        var names = ["appReady", "settings", "openURL", "requestReview", "privacy", "progress", "haptic"]
        // 広告が使えるときだけ登録する。登録しなければ、ゲーム側は広告ボタンそのものを出さない。
        if AppConfig.adsEnabled || DebugDeviceConfig.isDebugDevice { names.append("rewardAd") }
        if InterstitialAdController.isConfigured || DebugDeviceConfig.isDebugDevice { names.append("interstitial") }
        for name in names { config.userContentController.add(proxy, name: name) }

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator // 長押しメニュー(画像の保存など)を出さない
        webView.isOpaque = false
        webView.backgroundColor = .hhBackground
        webView.scrollView.backgroundColor = .hhBackground
        webView.scrollView.bounces = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.allowsLinkPreview = false
        #if DEBUG
        if #available(iOS 16.4, *) { webView.isInspectable = true } // Safari の Web インスペクタで確認できるように
        #endif
        webView.load(URLRequest(url: Self.startURL))
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKScriptMessageHandler, WKNavigationDelegate, WKUIDelegate {
        // 画像やリンクを長押ししたときのメニュー(保存・共有・プレビュー)を出さない
        func webView(_ webView: WKWebView, contextMenuConfigurationForElement elementInfo: WKContextMenuElementInfo,
                     completionHandler: @escaping (UIContextMenuConfiguration?) -> Void) {
            completionHandler(nil)
        }

        var onReady: (() -> Void)?
        private weak var readyWebView: WKWebView?
        private var observingConsent = false
        private let lightImpact = UIImpactFeedbackGenerator(style: .light)
        private let mediumImpact = UIImpactFeedbackGenerator(style: .medium)
        private let heavyImpact = UIImpactFeedbackGenerator(style: .heavy)
        private let notify = UINotificationFeedbackGenerator()

        init(onReady: (() -> Void)? = nil) { self.onReady = onReady }

        deinit { NotificationCenter.default.removeObserver(self) }

        // MARK: - WKNavigationDelegate

        /// メモリ逼迫で WebContent プロセスが破棄されると画面が真っ白のまま戻らないため、再読み込みする
        /// (ゲームは localStorage に保存しているので、つづきから再開できる)。
        func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
            print("[GameWebView] WebContent process terminated — reloading")
            if webView.url != nil { webView.reload() } else { webView.load(URLRequest(url: GameWebView.startURL)) }
        }

        /// ゲーム外へのリンク遷移は WebView 内で開かない(外部 URL は openURL メッセージで Safari へ)。
        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                     decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            let scheme = navigationAction.request.url?.scheme
            decisionHandler(scheme == GameWebView.scheme || scheme == "about" ? .allow : .cancel)
        }

        // MARK: - 同意設定の表示可否

        private func pushConsentApplicable() {
            let applicable = AppConfig.adsEnabled && ConsentManager.shared.isRegulationApplicable
            readyWebView?.evaluateJavaScript("window.__setConsentApplicable__ && window.__setConsentApplicable__(\(applicable))", completionHandler: nil)
        }

        private func startObservingConsent() {
            guard !observingConsent else { return }
            observingConsent = true
            NotificationCenter.default.addObserver(self, selector: #selector(consentMayHaveChanged),
                                                   name: ConsentManager.didUpdateNotification, object: nil)
            NotificationCenter.default.addObserver(self, selector: #selector(consentMayHaveChanged),
                                                   name: UIApplication.didBecomeActiveNotification, object: nil)
        }

        @objc private func consentMayHaveChanged() {
            DispatchQueue.main.async { [weak self] in self?.pushConsentApplicable() }
        }

        // MARK: - 音の復帰

        /// 広告・電話・ほかのアプリなどで音が割り込まれると、Web Audio は止まったまま戻らないことがある。
        /// 割り込みが終わったとき・アプリが前面に戻ったときに、音声セッションを戻してゲーム側の音を起こし直す。
        private var observingAudio = false
        private func startObservingAudio() {
            guard !observingAudio else { return }
            observingAudio = true
            NotificationCenter.default.addObserver(self, selector: #selector(audioInterrupted(_:)),
                                                   name: AVAudioSession.interruptionNotification, object: AVAudioSession.sharedInstance())
            NotificationCenter.default.addObserver(self, selector: #selector(appBecameActive),
                                                   name: UIApplication.didBecomeActiveNotification, object: nil)
        }

        @objc private func audioInterrupted(_ note: Notification) {
            guard let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
                  AVAudioSession.InterruptionType(rawValue: raw) == .ended else { return }
            DispatchQueue.main.async { [weak self] in self?.wakeWebAudio() }
        }

        @objc private func appBecameActive() {
            DispatchQueue.main.async { [weak self] in self?.wakeWebAudio() }
        }

        private func wakeWebAudio() {
            let session = AVAudioSession.sharedInstance()
            try? session.setCategory(.ambient, mode: .default, options: [.mixWithOthers])
            try? session.setActive(true)
            readyWebView?.evaluateJavaScript("window.hhAudioResume && window.hhAudioResume()", completionHandler: nil)
        }

        // MARK: - JS からのメッセージ

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            let body = message.body as? [String: Any] ?? [:]
            switch message.name {
            case "appReady":
                let webView = message.webView
                DispatchQueue.main.async {
                    self.onReady?()
                    self.readyWebView = webView
                    if DebugDeviceConfig.isDebugDevice { // 設定に「広告のあとの音を確認」を出す・広告の回数制限なし
                        webView?.evaluateJavaScript("window.__hhDebugDevice__ = true", completionHandler: nil)
                    }
                    self.pushConsentApplicable()
                    self.startObservingConsent()
                    self.startObservingAudio()
                }
            case "settings":
                guard let sleep = body["sleep"] as? Bool else { return }
                DispatchQueue.main.async { UIApplication.shared.isIdleTimerDisabled = sleep }
            case "openURL":
                guard let s = body["url"] as? String, let url = URL(string: s),
                      ["https", "http", "mailto"].contains(url.scheme ?? "") else { return }
                DispatchQueue.main.async { UIApplication.shared.open(url) }
            case "requestReview":
                DispatchQueue.main.async {
                    guard let scene = UIApplication.shared.connectedScenes
                        .first(where: { $0.activationState == .foregroundActive }) as? UIWindowScene else { return }
                    AppStore.requestReview(in: scene)
                }
            case "privacy":
                guard (body["action"] as? String) == "manageConsent" else { return }
                DispatchQueue.main.async { ConsentManager.shared.reopenConsentUI() }
            case "rewardAd":
                let allowed = DebugDeviceConfig.isDebugDevice ? ["revive", "blessing", "test"] : ["revive", "blessing"] // test は設定の音の確認(デバッグ端末だけ)
                guard let context = body["context"] as? String, allowed.contains(context) else { return }
                let webView = message.webView
                DispatchQueue.main.async {
                    RewardedAdController.shared.show { result in
                        // 結果は "rewarded" | "dismissed" | "nofill" | "nonetwork" | "unavailable" | "timeout"
                        let js = "window.__onRewardAdResult__ && window.__onRewardAdResult__('\(context)', '\(result.rawValue)')"
                        webView?.evaluateJavaScript(js, completionHandler: nil)
                        self.wakeWebAudio() // 広告が音を使ったあと、ゲームの音が止まったままにならないように
                    }
                }
            case "interstitial": // 5階ごとの区切りの広告。出せなければすぐ false を返す(プレイヤーを待たせない)
                let webView = message.webView
                DispatchQueue.main.async {
                    InterstitialAdController.shared.show { shown in
                        webView?.evaluateJavaScript("window.__onInterstitialDone__ && window.__onInterstitialDone__(\(shown))", completionHandler: nil)
                        if shown { self.wakeWebAudio() } // 広告が音を使ったあと、ゲームの音を戻す
                    }
                }
            case "haptic":
                let style = body["s"] as? String ?? "light"
                DispatchQueue.main.async { self.haptic(style) }
            case "progress":
                guard let event = body["event"] as? String else { return }
                logProgress(event: event, body: body)
            default:
                break
            }
        }

        private func haptic(_ style: String) {
            switch style {
            case "medium": mediumImpact.impactOccurred()
            case "heavy": heavyImpact.impactOccurred()
            case "success": notify.notificationOccurred(.success)
            case "error": notify.notificationOccurred(.error)
            default: lightImpact.impactOccurred()
            }
        }

        /// 進行度を Firebase Analytics に記録する。GA4 のカスタムディメンションに使う値は String で送る
        /// (Int のままだと探索レポートで (not set) になる)。階の数字は0埋めして番号順に並ぶようにする。
        private func logProgress(event: String, body: [String: Any]) {
            func num(_ key: String, _ width: Int = 2) -> String { String(format: "%0\(width)ld", (body[key] as? Int) ?? 0) }
            func str(_ key: String) -> String { (body[key] as? String) ?? "" }
            func flag(_ key: String) -> String { ((body[key] as? Bool) ?? false) ? "1" : "0" }
            switch event {
            case "lesson_start", "lesson_clear":
                AppAnalytics.log(event, parameters: ["lesson": str("lesson")])
            case "tutorial_complete":
                AppAnalytics.log("tutorial_complete")
            case "run_start":
                AppAnalytics.log("run_start", parameters: ["clears": num("clears")])
            case "floor_clear":
                AppAnalytics.log("floor_clear", parameters: ["floor": num("floor", 3)])
            case "death":
                AppAnalytics.log("death", parameters: ["floor": num("floor", 3), "enemy_id": str("enemyId"), "boss": flag("boss")])
            case "game_clear":
                AppAnalytics.log("game_clear", parameters: ["clears": num("clears")])
            case "reward_ad_result":
                AppAnalytics.log("reward_ad_result", parameters: ["context": str("context"), "result": str("result")])
            case "interstitial_result":
                AppAnalytics.log("interstitial_result", parameters: ["floor": body["floor"] as? Int ?? 0, "shown": (body["shown"] as? Bool ?? false) ? 1 : 0])
            case "user_props":
                if let best = body["bestFloor"] as? Int { AppAnalytics.setUserProperty(String(format: "%03ld", best), forName: "best_floor") }
                if let clears = body["clears"] as? Int { AppAnalytics.setUserProperty(String(clears), forName: "game_clears") }
            default:
                break
            }
        }
    }
}

/// WKUserContentController との強参照ループを断ち切るプロキシ。
private final class WeakScriptMessageProxy: NSObject, WKScriptMessageHandler {
    private weak var target: WKScriptMessageHandler?
    init(target: WKScriptMessageHandler) { self.target = target }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        target?.userContentController(userContentController, didReceive: message)
    }
}

/// hhapp:// のリクエストを、バンドル内の同名ファイルで返す。
final class GameSchemeHandler: NSObject, WKURLSchemeHandler {
    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url else { urlSchemeTask.didFailWithError(URLError(.badURL)); return }
        var name = url.lastPathComponent
        if name.isEmpty || name == "/" || name == "app" { name = "index.html" }
        let ext = (name as NSString).pathExtension, base = (name as NSString).deletingPathExtension
        guard let fileURL = Bundle.main.url(forResource: base, withExtension: ext),
              let data = try? Data(contentsOf: fileURL) else {
            urlSchemeTask.didFailWithError(URLError(.fileDoesNotExist)); return
        }
        let headers = ["Content-Type": Self.mime(for: ext), "Content-Length": String(data.count), "Cache-Control": "no-cache"]
        let response = HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: headers)!
        urlSchemeTask.didReceive(response)
        urlSchemeTask.didReceive(data)
        urlSchemeTask.didFinish()
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {}

    private static func mime(for ext: String) -> String {
        switch ext.lowercased() {
        case "html": return "text/html; charset=utf-8"
        case "js": return "text/javascript; charset=utf-8"
        case "css": return "text/css; charset=utf-8"
        case "json": return "application/json; charset=utf-8"
        case "ttf": return "font/ttf"
        case "otf": return "font/otf"
        case "woff2": return "font/woff2"
        case "png": return "image/png"
        case "mp3": return "audio/mpeg"
        default: return "application/octet-stream"
        }
    }
}
