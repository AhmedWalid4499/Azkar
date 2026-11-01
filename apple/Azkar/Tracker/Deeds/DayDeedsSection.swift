import AzkarKit
import SwiftUI

/// What a day holds of prayers made up, giving and the user's duas. Absent when it holds nothing.
struct TrackerDayDeedsSection: View {
    let data: TrackerData
    let records: DayRecords
    @Environment(AppEnvironment.self) private var app
    @Environment(\.trackerFormat) private var format

    var body: some View {
        if !records.makeups.isEmpty {
            Section {
                ForEach(records.makeups) { makeup in
                    LabeledContent {
                        Text(format.time(makeup.at)).monospacedDigit()
                    } label: {
                        Label { format.text(makeup.prayer.trackerName) } icon: { Image(systemName: "arrow.uturn.backward.circle.fill").foregroundStyle(.orange) }
                    }
                    .swipeActions(allowsFullSwipe: false) {
                        Button(role: .destructive) {
                            Task { try? await app.records.undoMakeup(makeup.id) }
                        } label: {
                            Label { Text("Delete", tableName: "Tracker") } icon: { Image(systemName: "trash") }
                        }
                    }
                }
            } header: {
                Text("Made up from before", tableName: "Tracker")
            }
        }
        if !records.giving.isEmpty {
            Section {
                ForEach(records.giving) { TrackerGivingRow(entry: $0) }
            } header: {
                format.text(TrackerArea.giving.title)
            }
        }
        if !records.duaEntries.isEmpty {
            Section {
                let said = records.duaEntries.filter { $0.kind == .said }.count
                let answered = records.duaEntries.filter { $0.kind == .answered }.count
                if said > 0 {
                    TrackerTotalRow(name: LocalizedStringResource("Duas made", table: "Tracker"), symbol: "hands.sparkles.fill", tint: .indigo, value: said)
                }
                if answered > 0 {
                    TrackerTotalRow(name: LocalizedStringResource("Answered", table: "Tracker"), symbol: "checkmark.seal.fill", tint: .green, value: answered)
                }
            } header: {
                format.text(TrackerArea.duas.title)
            }
        }
    }
}
