import AzkarKit
import SwiftUI

/// What was counted on the tasbih counter that day, by preset, then the free count.
struct TrackerDayTasbihSection: View {
    let data: TrackerData
    let records: DayRecords
    @Environment(\.trackerFormat) private var format

    var body: some View {
        let counted = records.tasbih.filter { $0.value.count > 0 }
        if !counted.isEmpty {
            let order = data.dataset.tasbihIDs
            let presets = counted.keys.sorted { lhs, rhs in
                rank(lhs, order) != rank(rhs, order) ? rank(lhs, order) < rank(rhs, order) : lhs < rhs
            }
            Section {
                ForEach(presets, id: \.self) { preset in
                    let count = counted[preset]!
                    LabeledContent {
                        Text(format.number(count.count)).monospacedDigit()
                    } label: {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(name(of: preset))
                                .lineLimit(2)
                            if let last = count.lastAt {
                                Text("Last count \(format.when(last, on: records.day))", tableName: "Tracker")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                    .accessibilityElement(children: .combine)
                }
            } header: {
                Text("Tasbih", tableName: "Tracker")
            } footer: {
                Text("\(TasbihStats.count(of: records.tasbihRecords)) counted in all", tableName: "Tracker")
            }
        }
    }

    /// Dataset presets in its order, then others, then the free count.
    private func rank(_ preset: String, _ order: [String]) -> Int {
        if preset == TasbihRecord.freeCount { return Int.max }
        return order.firstIndex(of: preset) ?? order.count
    }

    /// In English the dhikr's transliteration, in Arabic its text, both from the dataset.
    private func name(of preset: String) -> String {
        if preset == TasbihRecord.freeCount { return format.string(LocalizedStringResource("Free count", table: "Tracker")) }
        guard let dhikr = data.dataset.dhikr(id: preset) else { return preset }
        let name = format.isArabic ? dhikr.arabic : (dhikr.transliteration ?? dhikr.id)
        return name.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
