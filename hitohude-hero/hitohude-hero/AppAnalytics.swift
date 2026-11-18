//
//  AppAnalytics.swift
//  hitohude-hero
//
//  Firebase Analytics の薄いラッパー。GoogleService-Info.plist がバンドルに無い間は
//  Firebase を初期化せず、記録もすべて何もしない(未設定のまま FirebaseApp.configure() を
//  呼ぶと起動時にクラッシュするため)。
//

import Foundation
import FirebaseCore
import FirebaseAnalytics

enum AppAnalytics {
    /// GoogleService-Info.plist があれば Firebase を初期化する。アプリ起動時に一度だけ呼ぶ。
    static func configureIfAvailable() {
        guard FirebaseApp.app() == nil,
              Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist") != nil else {
            if FirebaseApp.app() == nil { print("[Analytics] GoogleService-Info.plist not found — analytics disabled") }
            return
        }
        FirebaseApp.configure()
    }

    static var isAvailable: Bool { FirebaseApp.app() != nil }

    static func log(_ name: String, parameters: [String: Any]? = nil) {
        guard isAvailable else { return }
        Analytics.logEvent(name, parameters: parameters)
    }

    static func setUserProperty(_ value: String?, forName name: String) {
        guard isAvailable else { return }
        Analytics.setUserProperty(value, forName: name)
    }

    static func setCollectionEnabled(_ enabled: Bool) {
        guard isAvailable else { return }
        Analytics.setAnalyticsCollectionEnabled(enabled)
    }
}
