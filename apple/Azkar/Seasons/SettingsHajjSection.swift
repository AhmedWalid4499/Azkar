import AzkarKit
import SwiftUI

/// Hajj and Umrah mode's switch in Settings.
struct SettingsHajjSection: View {
    @Environment(AppEnvironment.self) private var app

    var body: some View {
        Section {
            Toggle(isOn: Binding(
                get: { app.settings.settings.app.hajjMode },
                set: { on in app.settings.update { $0.app.hajjMode = on } }
            )) {
                Label {
                    Text(SeasonL("Hajj and Umrah mode"))
                } icon: {
                    Image(systemName: "building.columns.fill").foregroundStyle(.brown)
                }
            }
        } footer: {
            Text(SeasonL("Shows the steps of Umrah and Hajj on Today, with their duas and a counter for the laps of tawaf and sa'i."))
        }
    }
}
