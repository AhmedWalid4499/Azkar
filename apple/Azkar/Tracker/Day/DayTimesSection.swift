import AzkarKit
import SwiftUI

/// The day's prayer times at the saved place, when one is set.
struct TrackerDayTimesSection: View {
    let data: TrackerData
    let day: DayKey
    @Environment(\.trackerFormat) private var format

    var body: some View {
        if let location = data.settings.location, let times = TrackerClock.prayerDay(day, settings: data.settings) {
            Section {
                ForEach(TimeSlot.allCases) { slot in
                    LabeledContent {
                        if let at = times[slot] {
                            Text(format.time(at)).monospacedDigit()
                        } else {
                            Text(verbatim: "–").accessibilityLabel(Text("Not available", tableName: "Tracker"))
                        }
                    } label: {
                        format.text(slot.trackerName)
                    }
                }
            } header: {
                Text("Prayer times", tableName: "Tracker")
            } footer: {
                if !location.label.isEmpty {
                    Text(location.label)
                }
            }
        }
    }
}
