import AzkarKit
import SwiftUI

/// How many missed prayers are still to be made up, leading to the list of them.
struct TrackerMissedSummarySection: View {
    let data: TrackerData

    var body: some View {
        let missed = PrayerStats.outstandingMissed(data.history.prayers, today: data.today)
        Section {
            if missed.count > 0 {
                NavigationLink(value: TrackerRoute.missed) {
                    Label {
                        Text("\(missed.count) missed prayers to make up", tableName: "Tracker")
                    } icon: {
                        Image(systemName: PrayerStatus.missed.trackerSymbol).foregroundStyle(PrayerStatus.missed.trackerTint)
                    }
                }
            } else {
                Label {
                    Text("No missed prayers to make up", tableName: "Tracker")
                } icon: {
                    Image(systemName: "checkmark.seal.fill").foregroundStyle(.green)
                }
            }
        }
    }
}

/// Every missed prayer still owed, by day. Each day opens in full.
struct TrackerMissedPrayersView: View {
    let data: TrackerData
    @Environment(\.trackerFormat) private var format

    var body: some View {
        let missed = PrayerStats.outstandingMissed(data.history.prayers, today: data.today)
        let byDay = Dictionary(grouping: missed.prayers, by: \.day)
        List {
            if missed.count == 0 {
                ContentUnavailableView {
                    Label { Text("No missed prayers to make up", tableName: "Tracker") } icon: { Image(systemName: "checkmark.seal") }
                }
            } else {
                Section {
                    // Most recent first: the one most likely being made up now.
                    ForEach(missed.days.reversed(), id: \.self) { day in
                        let prayers = (byDay[day] ?? []).map { format.string($0.prayer.trackerName) }
                        NavigationLink(value: TrackerRoute.day(day)) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(format.fullDay(day))
                                Text(format.list(prayers))
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .accessibilityHint(Text("Opens the day", tableName: "Tracker"))
                    }
                } header: {
                    Text("\(missed.count) missed prayers to make up", tableName: "Tracker")
                } footer: {
                    Text("Once you have made up a prayer, log it as made up and it leaves this list.", tableName: "Tracker")
                }
            }
        }
        .navigationTitle(Text("Missed prayers", tableName: "Tracker"))
        .navigationBarTitleDisplayMode(.inline)
    }
}
