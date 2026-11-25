import AzkarKit
import SwiftUI

/// What was counted on the tasbih counter that day, by preset, then the free count.
struct TrackerDayTasbihSection: View {
    let data: TrackerData
    let records: DayRecords
    @Environment(\.trackerFormat) private var format

    var body: some View {
        let counted = records.tasbih.filter { $0.value.count > 0 && TasbihRecord.isTasbih($0.key) }
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
        if preset == TasbihRecord.takbir { return format.string(LocalizedStringResource("Takbir", table: "Tracker")) }
        guard let dhikr = data.dataset.dhikr(id: preset) else { return preset }
        let name = format.isArabic ? dhikr.arabic : (dhikr.transliteration ?? dhikr.id)
        return name.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

/// The duas for occasions said that day, by chapter, with how many times each was said.
struct TrackerDayOccasionsSection: View {
    let records: DayRecords
    @Environment(\.trackerFormat) private var format
    private let book = OccasionsBook.bundled

    var body: some View {
        let said = records.tasbih.filter { TasbihRecord.isOccasion($0.key) && $0.value.count > 0 }
        if !said.isEmpty {
            let ids = said.keys.sorted { lhs, rhs in
                let left = book.chapter(ofItem: lhs)?.number ?? Int.max, right = book.chapter(ofItem: rhs)?.number ?? Int.max
                return left != right ? left < right : lhs < rhs
            }
            Section {
                ForEach(ids, id: \.self) { id in
                    let count = said[id]!
                    LabeledContent {
                        Text(format.number(count.count)).monospacedDigit()
                    } label: {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(verbatim: name(of: id)).lineLimit(2)
                            if let last = count.lastAt {
                                Text("Last said \(format.when(last, on: records.day))", tableName: "Tracker")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                    .accessibilityElement(children: .combine)
                }
            } header: {
                Text("Duas for occasions", tableName: "Tracker")
            } footer: {
                Text("\(OccasionStats.count(of: records.tasbihRecords)) said in all", tableName: "Tracker")
            }
        }
    }

    /// The chapter's title, and which of its duas when it has more than one.
    private func name(of id: String) -> String {
        guard let chapter = book.chapter(ofItem: id) else { return id }
        let title = format.isArabic ? chapter.title.ar : chapter.title.en
        guard chapter.items.count > 1, let index = chapter.items.firstIndex(of: id) else { return title }
        return "\(title) (\(format.number(index + 1)))"
    }
}
