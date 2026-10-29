import SwiftUI
import UIKit

/// Keeps the screen from dimming while the view is on screen and the app is active, then puts
/// the idle timer back as it was. SwiftUI has no API for the idle timer.
private struct KeepAwake: ViewModifier {
    let isOn: Bool
    @Environment(\.scenePhase) private var scenePhase
    @State private var previous: Bool?
    @State private var isVisible = false

    func body(content: Content) -> some View {
        content
            .onAppear {
                isVisible = true
                apply()
            }
            .onDisappear {
                isVisible = false
                apply()
            }
            .onChange(of: isOn) { apply() }
            .onChange(of: scenePhase) { apply() }
    }

    private func apply() {
        let application = UIApplication.shared
        if isOn && isVisible && scenePhase == .active {
            if previous == nil { previous = application.isIdleTimerDisabled }
            application.isIdleTimerDisabled = true
        } else if let earlier = previous {
            application.isIdleTimerDisabled = earlier
            previous = nil
        }
    }
}

extension View {
    /// Keeps the screen awake while this view shows, when `isOn` (`ReaderSettings.keepAwake`).
    func keepsScreenAwake(_ isOn: Bool) -> some View {
        modifier(KeepAwake(isOn: isOn))
    }
}
