import AzkarKit
import SwiftUI

/// Menstrual mode's switch in Settings. Turning it on asks first (`MenstrualModeSheet`).
struct SettingsMenstrualSection: View {
    @Environment(AppEnvironment.self) private var app
    @Environment(\.locale) private var locale
    @State private var asks = false

    var body: some View {
        let since = app.settings.settings.app.menstrualSince
        Section {
            Toggle(isOn: Binding(
                get: { since != nil },
                set: { on in
                    if on {
                        asks = true
                    } else {
                        Task { await MenstrualMode.turnOff(app) }
                    }
                }
            )) {
                Label {
                    Text(M("Menstrual mode"))
                } icon: {
                    Image(systemName: "moon.stars.fill").foregroundStyle(Color.menstrual)
                }
            }
            .tint(.menstrual)
        } footer: {
            if let since {
                Text(M("On since \(started(since)). Prayers are logged as excused and their reminders are paused."))
            } else {
                Text(M("For women: during your period, prayers are logged as excused and their reminders pause."))
            }
        }
        .sheet(isPresented: $asks) {
            MenstrualModeSheet { MenstrualMode.turnOn(app) }
                .appDirection()
        }
        #if DEBUG
        // `-AzkarDemoSheet menstrual` opens the question at launch, for screenshots.
        .task { if UserDefaults.standard.string(forKey: "AzkarDemoSheet") == "menstrual" { asks = true } }
        #endif
    }

    /// "Monday 16 November, 9:23 PM", where the user is and in the app's language.
    private func started(_ date: Date) -> String {
        var style = Date.FormatStyle(locale: locale, timeZone: app.settings.settings.timeZone)
        style = style.weekday(.wide).day().month(.wide).hour().minute()
        return date.formatted(style)
    }
}
