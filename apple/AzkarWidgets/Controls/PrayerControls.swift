import AppIntents
import AzkarKit
import SwiftUI
import WidgetKit

/// Control Center (and Lock Screen / Action button) control: logs the current prayer, or the latest
/// one whose time has come and is not logged, without opening the app.
struct LogPrayerControl: ControlWidget {
    static let kind = "io.github.ahmedwalid4499.azkar.log-prayer"

    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: Self.kind) {
            ControlWidgetButton(action: LogCurrentPrayerIntent()) {
                Label {
                    Text("Log prayer", tableName: SystemText.table)
                } icon: {
                    Image(systemName: "checkmark.circle")
                }
            }
        }
        .displayName(LocalizedStringResource("Log Current Prayer", table: SystemText.table))
        .description(LocalizedStringResource("Marks the prayer whose time it is as prayed.", table: SystemText.table))
    }
}

/// Opens the Qibla compass.
struct OpenQiblaControl: ControlWidget {
    static let kind = "io.github.ahmedwalid4499.azkar.qibla"

    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: Self.kind) {
            ControlWidgetButton(action: OpenQiblaIntent()) {
                Label {
                    Text("Qibla", tableName: SystemText.table)
                } icon: {
                    Image(systemName: "location.north.line")
                }
            }
        }
        .displayName(LocalizedStringResource("Open Qibla", table: SystemText.table))
        .description(LocalizedStringResource("Shows the direction of the Kaaba.", table: SystemText.table))
    }
}
