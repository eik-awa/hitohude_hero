//
//  AppConfig.swift
//  hitohude-hero
//
//  広告・同意管理まわりの ID をここに集める(ダッシュボードで発行した値を入れる)。
//  空文字のままなら、その機能は起動しない(広告 SDK の初期化・ATT・同意画面をすべて省略し、
//  ゲーム側の広告ボタンも表示されない)。開発中や審査前でもアプリは普通に遊べる。
//

import Foundation

enum AppConfig {
    /// LevelPlay の App Key(LevelPlay ダッシュボード → Apps → App Key)。
    /// Unity Dashboard の Game ID とは別の値なので注意。
    static let levelPlayAppKey = "29b2647bd"
    /// LevelPlay の Ad Units で発行したバナー広告の ID。
    static let bannerAdUnitID = "w1fjyxjkipld6tgn"
    /// LevelPlay の Ad Units で発行したリワード広告の ID。
    static let rewardedAdUnitID = "4ap8i8qaeb1d5l8f"
    /// LevelPlay の Ad Units で発行したインタースティシャル広告の ID(5階ごとに表示)。空なら出さない。
    static let interstitialAdUnitID = "em0ha53vw96oex69"
    /// InMobi Choice(choice.inmobi.com)で、このアプリの Bundle ID に紐づけて発行した p-code。
    static let inMobiPCode = "e_de1zrrLkmzK"

    /// 広告を配信するか(App Key と両方の Ad Unit ID がそろっているときだけ)。
    static var adsEnabled: Bool {
        !levelPlayAppKey.isEmpty && !bannerAdUnitID.isEmpty && !rewardedAdUnitID.isEmpty
    }

    /// プライバシーポリシー(ダンジョンローグと共通)。
    static let privacyPolicyURL = "https://eik-awa.github.io/privacy_policy/"
}
