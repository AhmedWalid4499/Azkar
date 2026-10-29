import AzkarKit
import SwiftUI

/// The day's five obligatory prayers, each with its status picker and when it was logged.
struct TrackerDayPrayersSection: View {
    let data: TrackerData
    let day: DayKey
    let record: DayPrayerRecord

    var body: some View {
        let summary = PrayerStats.summarize(record)
        Section {
            ForEach(Prayer.allCases) { prayer in
                TrackerPrayerStatusRow(prayer: prayer, day: day, entry: record.prayers[prayer])
            }
        } header: {
            Text("Obligatory prayers", tableName: "Tracker")
        } footer: {
            if summary.logged > 0 {
                Text("\(summary.prayed) of \(summary.due) prayed", tableName: "Tracker")
            }
        }
    }
}

/// One prayer: its status (or none) in a menu, and when it was logged.
private struct TrackerPrayerStatusRow: View {
    let prayer: Prayer
    let day: DayKey
    let entry: PrayerEntry?
    @Environment(AppEnvironment.self) private var app
    @Environment(\.trackerFormat) private var format
    @State private var changes = 0

    var body: some View {
        let status = entry?.status
        Picker(selection: Binding(get: { status }, set: set)) {
            format.text(TrackerUnloggedPrayer.name)
                .tag(PrayerStatus?.none)
            ForEach(PrayerStatus.pickerOrder, id: \.self) { option in
                format.text(option.trackerName)
                    .tag(PrayerStatus?.some(option))
            }
        } label: {
            Label {
                VStack(alignment: .leading, spacing: 2) {
                    format.text(prayer.trackerName)
                    if let at = entry?.loggedAt {
                        Text("Logged \(format.when(at, on: day))", tableName: "Tracker")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            } icon: {
                Image(systemName: status?.trackerSymbol ?? TrackerUnloggedPrayer.symbol)
                    .foregroundStyle(status.map { AnyShapeStyle($0.trackerTint) } ?? AnyShapeStyle(.tertiary))
                    .contentTransition(.symbolEffect(.replace))
            }
        }
        .pickerStyle(.menu)
        .sensoryFeedback(.selection, trigger: changes)
        .accessibilityHint(status.map { format.text($0.trackerHint) } ?? Text(""))
    }

    private func set(_ status: PrayerStatus?) {
        changes += 1
        Task { try? await app.records.setPrayer(prayer, status, on: day) }
    }
}
