import AzkarKit
import SwiftUI

/// Everything ever recorded: prayers, sunnah, azkar sessions, recitations, tasbih and fasts.
struct TrackerLifetimeSection: View {
    let data: TrackerData
    @Environment(\.trackerFormat) private var format

    var body: some View {
        let prayers = TrackerStats.lifetimePrayers(data.history.prayers, today: data.today)
        let totals = data.records.totals
        let azkar = AzkarStats.lifetime(data.history.sessions, totals: totals.dhikr, totalRecitations: totals.recitations, dataset: data.dataset)
        let completed = azkar.sessionsCompleted
        let afterPrayer = data.afterPrayers.reduce(0) { $0 + (completed[.afterPrayer($1)] ?? 0) }
        let sessions = completed.values.reduce(0, +)
        Section {
            TrackerTotalRow(name: LocalizedStringResource("Prayers prayed", table: "Tracker"), symbol: "building.columns.fill", tint: .green, value: prayers.prayed) {
                Text("Logged in all: \(prayers.logged)", tableName: "Tracker")
            }
            TrackerTotalRow(name: LocalizedStringResource("Sunnah prayers", table: "Tracker"), symbol: "sparkles", tint: .teal, value: prayers.sunnah)
            TrackerTotalRow(name: LocalizedStringResource("Azkar sessions completed", table: "Tracker"), symbol: "book.closed.fill", tint: .indigo, value: sessions) {
                Text(sessionBreakdown(completed, afterPrayer: afterPrayer))
            }
            TrackerTotalRow(name: LocalizedStringResource("Recitations", table: "Tracker"), symbol: "text.book.closed.fill", tint: .purple, value: totals.recitations) {
                Text("Every count in the reader", tableName: "Tracker")
            }
            TrackerTotalRow(name: LocalizedStringResource("Tasbih", table: "Tracker"), symbol: "circle.hexagongrid.fill", tint: .brown, value: totals.tasbihCount)
            TrackerTotalRow(name: LocalizedStringResource("Fasts kept", table: "Tracker"), symbol: TrackerMark.fast, tint: .orange,
                     value: data.history.fasts.values.filter { $0.status == .fasted }.count)
        } header: {
            Text("All time", tableName: "Tracker")
        }
    }

    private func sessionBreakdown(_ completed: [AzkarSession: Int], afterPrayer: Int) -> String {
        var parts = [
            format.string(LocalizedStringResource("Morning \(completed[.morning] ?? 0)", table: "Tracker")),
            format.string(LocalizedStringResource("Evening \(completed[.evening] ?? 0)", table: "Tracker")),
        ]
        if data.showsSleep { parts.append(format.string(LocalizedStringResource("Before sleep \(completed[.sleep] ?? 0)", table: "Tracker"))) }
        if !data.afterPrayers.isEmpty { parts.append(format.string(LocalizedStringResource("After prayers \(afterPrayer)", table: "Tracker"))) }
        return parts.joined(separator: " · ")
    }
}

/// A lifetime total, with an optional line under its name.
private struct TrackerTotalRow<Detail: View>: View {
    let name: LocalizedStringResource
    let symbol: String
    let tint: Color
    let value: Int
    @ViewBuilder var detail: Detail
    @Environment(\.trackerFormat) private var format

    var body: some View {
        LabeledContent {
            Text(format.number(value))
                .font(.body.weight(.semibold).monospacedDigit())
                .foregroundStyle(.primary)
        } label: {
            Label {
                VStack(alignment: .leading, spacing: 2) {
                    format.text(name)
                    detail
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            } icon: {
                Image(systemName: symbol).foregroundStyle(tint)
            }
        }
        .accessibilityElement(children: .combine)
    }
}

extension TrackerTotalRow where Detail == EmptyView {
    init(name: LocalizedStringResource, symbol: String, tint: Color, value: Int) {
        self.init(name: name, symbol: symbol, tint: tint, value: value) { EmptyView() }
    }
}
