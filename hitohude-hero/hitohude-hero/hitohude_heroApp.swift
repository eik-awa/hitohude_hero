//
//  hitohude_heroApp.swift
//  hitohude-hero
//
//  Created by eiki ogawa on 2026/11/18.
//

import SwiftUI
import AppTrackingTransparency
import AVFoundation
import IronSource

@main
struct hitohude_heroApp: App {
    @Environment(\.scenePhase) private var scenePhase

    init() {
        AppAnalytics.configureIfAvailable()
        // ATT の応答が済むまでは収集を止めておき、応答後に有効化する(同意前収集を避けるため)。
        AppAnalytics.setCollectionEnabled(false)
        // 効果音・BGM は他アプリの音楽と混ぜて鳴らす(Apple Music などを止めない)。
        // カテゴリだけ設定し、setActive(true) は実際に音を出すまで呼ばない。
        try? AVAudioSession.sharedInstance().setCategory(.ambient, mode: .default, options: [.mixWithOthers])
        print("[DebugBadge] Identifier: \(DebugDeviceConfig.persistentDeviceID)")
    }

    // ATT の要求は一度だけ行う。
    @State private var didRequestTracking = false

    var body: some Scene {
        WindowGroup {
            ContentView()
                .preferredColorScheme(.dark)
        }
        .onChange(of: scenePhase) { _, phase in
            guard phase == .active else { return }
            guard AppConfig.adsEnabled else {
                // 広告を使わない間は ATT も同意画面も出さない。計測(設定済みなら)だけ有効にする。
                AppAnalytics.setCollectionEnabled(true)
                return
            }
            if didRequestTracking {
                // 2回目以降のフォアグラウンド復帰: 広告 SDK の初期化・リワード広告の再ロードを再試行する。
                LevelPlayAdsController.shared.initializeIfNeeded()
            } else {
                requestTrackingThenStartAds()
            }
        }
    }

    /// GDPR/CCPA 同意(InMobi Choice)・ATT 許諾・広告 SDK 初期化を行う。
    /// 広告 SDK の初期化は同意フローの完了を待たずに始める(CMP が応答しない場合でも広告が止まらないように。
    /// LevelPlay SDK は UserDefaults の IAB TCF 文字列を自動で読み取って GDPR 制限を適用する)。
    private func requestTrackingThenStartAds() {
        guard !didRequestTracking else { return }
        didRequestTracking = true
        LevelPlayAdsController.shared.initialize()

        ConsentManager.shared.requestConsentIfNeeded { resolved in
            Task {
                // 初回起動直後は UI がまだ完全にアクティブでないことがあるため、少し待ってから提示する。
                try? await Task.sleep(nanoseconds: 500_000_000)
                await ATTrackingManager.requestTrackingAuthorization()
                // resolved=false はオフライン等で CMP が応答しなかった場合。同意前の収集を避けるため計測は有効にしない。
                if resolved && ConsentManager.shared.canEnableAnalytics {
                    AppAnalytics.setCollectionEnabled(true)
                } else if !resolved {
                    print("[Consent] resolution timed out (offline or not configured) — keeping analytics collection disabled")
                } else {
                    print("[Consent] analytics purpose consent denied — keeping analytics collection disabled")
                }
                // 本アプリは子ども向けではない(13歳未満を対象としない)。
                LPMPrivacySettings.setCOPPA(false)
                LevelPlayAdsController.shared.initializeIfNeeded()
            }
        }
    }
}
