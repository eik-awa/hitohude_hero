//
//  ContentView.swift
//  hitohude-hero
//
//  ゲーム(WebView)と、画面最下部のバナー広告を並べる。
//

import SwiftUI

struct ContentView: View {
    @State private var gameReady = false
    @Environment(\.scenePhase) private var scenePhase

    /// バナー枠を出すか(広告を設定済み、またはデバッグ端末でテストモード表示をするとき)。
    private var showsBanner: Bool { AppConfig.adsEnabled || DebugDeviceConfig.isDebugDevice }

    var body: some View {
        ZStack {
            VStack(spacing: 0) {
                GameWebView(onReady: { gameReady = true })
                if showsBanner {
                    AdBannerView(adUnitID: AppConfig.bannerAdUnitID)
                        .frame(height: 50)
                }
            }
            .background(Color.hhBackground)
            // 上端のセーフエリア(ノッチ等)はゲーム側の CSS(env(safe-area-inset-top))で避ける
            .ignoresSafeArea(.container, edges: .top)

            if !gameReady {
                SplashView()
                    .transition(.opacity)
                    .ignoresSafeArea()
            }

            // アプリスイッチャーのスクリーンショットにゲーム画面を映さない
            if scenePhase != .active {
                Color.hhBackground.ignoresSafeArea()
            }
        }
        .animation(.easeOut(duration: 0.5), value: gameReady)
        .onAppear { UIApplication.shared.isIdleTimerDisabled = true }
        .task {
            // 何らかの理由で appReady が届かなくても、スプラッシュで固まらないようにする
            try? await Task.sleep(nanoseconds: 8_000_000_000)
            gameReady = true
        }
    }
}

// MARK: - Splash Screen

struct SplashView: View {
    var body: some View {
        ZStack {
            Color.hhBackground.ignoresSafeArea()
            VStack(spacing: 20) {
                if let image = Bundle.main.appIcon {
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFit()
                        .frame(width: 110, height: 110)
                        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
                        .shadow(color: .black.opacity(0.6), radius: 24)
                }
                Text("now loading...")
                    .font(.system(size: 13, weight: .light, design: .monospaced))
                    .foregroundColor(Color(red: 0.95, green: 0.9, blue: 0.78).opacity(0.5))
                    .kerning(3)
                ProgressView()
                    .tint(Color(red: 1.0, green: 0.886, blue: 0.478))
                    .scaleEffect(1.3)
            }
        }
    }
}

private extension Bundle {
    /// アプリアイコン(appiconset は UIImage(named:) で取れないことがあるため Info.plist も辿る)。
    var appIcon: UIImage? {
        if let img = UIImage(named: "AppIcon") { return img }
        guard let icons = infoDictionary?["CFBundleIcons"] as? [String: Any],
              let primary = icons["CFBundlePrimaryIcon"] as? [String: Any] else { return nil }
        if let name = primary["CFBundleIconName"] as? String, let img = UIImage(named: name) { return img }
        if let files = primary["CFBundleIconFiles"] as? [String] { return files.reversed().compactMap { UIImage(named: $0) }.first }
        return nil
    }
}

#Preview {
    ContentView()
}
