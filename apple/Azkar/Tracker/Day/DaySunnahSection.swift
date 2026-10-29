import AzkarKit
import SwiftUI

/// The day's sunnah prayers, each a switch with the time it was ticked.
struct TrackerDaySunnahSection: View {
    let data: TrackerData
    let day: DayKey
    let record: DayPrayerRecord

    var body: some View {
        let summary = SunnahStats.summarize(record)
        Section {
            ForEach(SunnahPrayer.allCases, id: \.self) { sunnah in
                TrackerSunnahToggleRow(sunnah: sunnah, day: day, doneAt: record.sunnah[sunnah], excused: SunnahStats.isExcused(sunnah, on: record))
            }
        } header: {
            Text("Sunnah prayers", tableName: "Tracker")
        } footer: {
            Text("Rawatib: \(summary.rawatibRakahs) of \(12) rak’ahs", tableName: "Tracker")
        }
    }
}

private struct TrackerSunnahToggleRow: View {
    let sunnah: SunnahPrayer
    let day: DayKey
    let doneAt: Date?
    let excused: Bool
    @Environment(AppEnvironment.self) private var app
    @Environment(\.trackerFormat) private var format

    var body: some View {
        Toggle(isOn: Binding(get: { doneAt != nil }, set: set)) {
            Label {
                VStack(alignment: .leading, spacing: 2) {
                    format.text(sunnah.trackerName)
                    if let doneAt {
                        Text("Logged \(format.when(doneAt, on: day))", tableName: "Tracker")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    } else if excused {
                        Text("Excused with its prayer", tableName: "Tracker")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            } icon: {
                Image(systemName: sunnah.trackerSymbol).foregroundStyle(.teal)
            }
        }
        .sensoryFeedback(.selection, trigger: doneAt != nil)
    }

    private func set(_ done: Bool) {
        Task { try? await app.records.setSunnah(sunnah, done: done, on: day) }
    }
}
