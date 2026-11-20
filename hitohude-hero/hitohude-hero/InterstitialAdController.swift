//
//  InterstitialAdController.swift
//  hitohude-hero
//
//  インタースティシャル広告(Unity LevelPlay)。5階ごとの区切り(休憩所から次の階へ進むとき)に JS から呼ばれる。
//  いつ出すか(5階ごと・リワード広告の直後は出さない など)は JS 側(app.js)で決め、
//  ネイティブ側は「先読み」と「出せるなら出す」だけを担当する。
//  プレイヤーを待たせないため、表示の時点で読み込めていなければ出さずにすぐ返す(次の区切りまでに読み込んでおく)。
//

import Foundation
import UIKit
import IronSource

private final class InterstitialAdDelegate: NSObject, LPMInterstitialAdDelegate {
    private weak var owner: InterstitialAdController?
    let generation: UInt64
    init(owner: InterstitialAdController, generation: UInt64) {
        self.owner = owner
        self.generation = generation
    }
    func didLoadAd(with adInfo: LPMAdInfo) { owner?.handleLoad(generation: generation) }
    func didFailToLoadAd(withAdUnitId adUnitId: String, error: Error) { owner?.handleLoadFail(generation: generation, error: error) }
    func didDisplayAd(with adInfo: LPMAdInfo) {}
    func didFailToDisplayAd(with adInfo: LPMAdInfo, error: Error) { owner?.handleClosed(generation: generation, shown: false) }
    func didClickAd(with adInfo: LPMAdInfo) {}
    func didCloseAd(with adInfo: LPMAdInfo) { owner?.handleClosed(generation: generation, shown: true) }
}

final class InterstitialAdController: NSObject {
    static let shared = InterstitialAdController()

    /// 広告の ID がそろっているか(なければ何もしない)
    static var isConfigured: Bool { AppConfig.adsEnabled && !AppConfig.interstitialAdUnitID.isEmpty }

    private var ad: LPMInterstitialAd?
    private var delegate: InterstitialAdDelegate?
    private var generation: UInt64 = 0
    private var isLoading = false
    private var isShowing = false
    private var failures = AdLoadFailureTracker()
    private var retryWork: DispatchWorkItem?
    private var onClosed: ((Bool) -> Void)?

    /// LevelPlay の初期化が終わったとき・アプリが前面に戻ったときに呼ぶ。読み込み済み/読み込み中なら何もしない。
    func preloadIfNeeded() {
        guard Self.isConfigured, !isShowing, !isLoading else { return }
        if let ad, ad.isAdReady() { return }
        load()
    }

    private func load() {
        retryWork?.cancel(); retryWork = nil
        isLoading = true
        generation += 1
        let d = InterstitialAdDelegate(owner: self, generation: generation)
        let newAd = LPMInterstitialAd(adUnitId: AppConfig.interstitialAdUnitID)
        newAd.setDelegate(d)
        delegate = d
        ad = newAd
        newAd.loadAd()
    }

    fileprivate func handleLoad(generation g: UInt64) {
        guard g == generation else { return }
        isLoading = false
        failures.reset()
    }

    fileprivate func handleLoadFail(generation g: UInt64, error: Error) {
        guard g == generation else { return }
        isLoading = false
        failures.record()
        print("[Interstitial] load failed: \((error as NSError).code)")
        let work = DispatchWorkItem { [weak self] in self?.preloadIfNeeded() }
        retryWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + failures.nextDelay(), execute: work)
    }

    fileprivate func handleClosed(generation g: UInt64, shown: Bool) {
        guard g == generation, isShowing else { return }
        isShowing = false
        let cb = onClosed; onClosed = nil
        cb?(shown)
        load() // 次の区切りのために読み込んでおく
    }

    /// 出せるなら出す。結果(実際に表示したか)を閉じたあとに返す。読み込めていなければすぐ false。
    /// デバッグ端末では本番の広告を出さず、テスト広告(短い・いつでも閉じられる)を出す。
    func show(completion: @escaping (Bool) -> Void) {
        guard let vc = UIApplication.shared.hhTopViewController else { completion(false); return }
        if DebugDeviceConfig.isDebugDevice {
            vc.present(DebugTestAdViewController(kind: .interstitial) { _ in completion(true) }, animated: true)
            return
        }
        guard Self.isConfigured, !isShowing, let ad, ad.isAdReady() else {
            AppAnalytics.log("interstitial_skip", parameters: ["reason": isShowing ? "showing" : "not_ready"])
            preloadIfNeeded()
            completion(false)
            return
        }
        isShowing = true
        onClosed = completion
        AppAnalytics.log("interstitial_show", parameters: [:])
        ad.showAd(viewController: vc, placementName: nil)
    }
}
