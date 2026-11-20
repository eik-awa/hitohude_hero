//
//  DebugTestAdViewController.swift
//  hitohude-hero
//
//  デバッグ端末(DebugDeviceConfig.isDebugDevice)用のテスト広告画面。
//  本物のリワード広告と同じように、全画面で表示し、オーディオセッションを .playback(他の音と混ぜない)で
//  奪う(音は鳴らさない)。閉じたあとにゲームの BGM・効果音が戻るかを、広告の ID なしで確かめるためのもの。
//  リワード: 5秒たつ前に閉じると「途中で閉じた(dismissed)」、5秒たってから閉じると「視聴完了(rewarded)」。
//  インタースティシャル: いつでも閉じられる(閉じた結果は使わない)。
//

import UIKit
import AVFoundation

final class DebugTestAdViewController: UIViewController {
    enum Kind { case rewarded, interstitial }
    private let kind: Kind
    private let completion: (RewardAdResult) -> Void
    private var remain = 5
    private var timer: Timer?
    private var finished = false
    private let countLabel = UILabel()

    init(kind: Kind = .rewarded, completion: @escaping (RewardAdResult) -> Void) {
        self.kind = kind
        self.completion = completion
        super.init(nibName: nil, bundle: nil)
        modalPresentationStyle = .fullScreen
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.08, green: 0.07, blue: 0.12, alpha: 1)

        let title = UILabel()
        title.text = kind == .interstitial ? "テスト広告（5階ごと）" : "テスト広告"
        title.font = .boldSystemFont(ofSize: 28)
        title.textColor = .white
        let note = UILabel()
        note.text = "本物の広告と同じように、ゲームの音を止めています。\n閉じたあとに、BGM と効果音が戻るか確かめてください。"
        note.numberOfLines = 0
        note.textAlignment = .center
        note.font = .systemFont(ofSize: 15)
        note.textColor = UIColor(white: 1, alpha: 0.75)
        countLabel.font = .monospacedDigitSystemFont(ofSize: 17, weight: .medium)
        countLabel.textColor = UIColor(red: 1, green: 0.89, blue: 0.48, alpha: 1)
        updateCount()

        let stack = UIStackView(arrangedSubviews: [title, note, countLabel])
        stack.axis = .vertical
        stack.alignment = .center
        stack.spacing = 18
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)

        let close = UIButton(type: .system)
        close.setTitle("✕", for: .normal)
        close.titleLabel?.font = .systemFont(ofSize: 24, weight: .bold)
        close.tintColor = .white
        close.backgroundColor = UIColor(white: 1, alpha: 0.15)
        close.layer.cornerRadius = 22
        close.translatesAutoresizingMaskIntoConstraints = false
        close.addTarget(self, action: #selector(closeTapped), for: .touchUpInside)
        view.addSubview(close)

        NSLayoutConstraint.activate([
            stack.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            stack.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            stack.leadingAnchor.constraint(greaterThanOrEqualTo: view.leadingAnchor, constant: 24),
            close.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 12),
            close.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -16),
            close.widthAnchor.constraint(equalToConstant: 44),
            close.heightAnchor.constraint(equalToConstant: 44),
        ])
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        startSound()
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            guard let self else { return }
            self.remain = max(0, self.remain - 1)
            self.updateCount()
        }
    }

    private func updateCount() {
        if kind == .interstitial {
            countLabel.text = "インタースティシャル広告のテスト。✕ でいつでも閉じられます"
            return
        }
        countLabel.text = remain > 0 ? "あと \(remain) 秒で報酬（いま閉じると報酬なし）" : "報酬を獲得しました。✕ で閉じる"
    }

    // 広告 SDK と同じく、他の音と混ぜないセッションを奪う(音は鳴らさない。ゲームの Web Audio はここで止まる)
    private func startSound() {
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.playback, mode: .default, options: [])
        try? session.setActive(true)
    }

    @objc private func closeTapped() {
        guard !finished else { return }
        finished = true
        timer?.invalidate()
        // 広告 SDK が閉じるときと同じく、セッションを手放す(戻すのは GameWebView の wakeWebAudio)
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        let result: RewardAdResult = remain > 0 ? .dismissed : .rewarded
        dismiss(animated: true) { [completion] in completion(result) }
    }
}
