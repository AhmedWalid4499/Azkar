import AVFoundation
import SwiftUI

/// Plays the adhan the prayer notifications use, so it can be heard before choosing it.
struct AdhanPreviewButton: View {
    @State private var player: AVAudioPlayer?
    @State private var playing = false
    @State private var finished: Task<Void, Never>?

    var body: some View {
        Button {
            playing ? stop() : play()
        } label: {
            Label {
                Text(playing ? "Stop" : "Listen", tableName: SettingsText.table)
            } icon: {
                Image(systemName: playing ? "stop.fill" : "play.fill")
            }
        }
        .onDisappear { stop() }
    }

    private func play() {
        guard let url = Bundle.main.url(forResource: ReminderContent.adhanSound, withExtension: nil),
              let player = try? AVAudioPlayer(contentsOf: url) else { return }
        // Heard even with the silent switch on, since it was asked for.
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)
        try? AVAudioSession.sharedInstance().setActive(true)
        player.play()
        self.player = player
        playing = true
        let length = player.duration
        finished?.cancel()
        finished = Task {
            try? await Task.sleep(for: .seconds(length + 0.2))
            if !Task.isCancelled { stop() }
        }
    }

    private func stop() {
        finished?.cancel()
        player?.stop()
        player = nil
        playing = false
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
}
