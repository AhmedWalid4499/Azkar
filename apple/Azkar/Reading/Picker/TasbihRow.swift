import AzkarKit
import SwiftUI

/// The picker's way into the tasbih counter, with what was counted on it today.
struct TasbihRow: View {
    /// The day the counter files a count under now.
    let day: DayKey
    @Environment(ReadingContext.self) private var context
    @Environment(\.readingLocale) private var locale

    var body: some View {
        let today = TasbihStats.count(of: context.day(day).tasbihRecords)
        NavigationLink(value: ReadingDestination.tasbih) {
            HStack(spacing: 14) {
                ReadingProgressBadge(fraction: 0, systemImage: "circle.hexagongrid", tint: .mint)
                VStack(alignment: .leading, spacing: 3) {
                    Text("Tasbih", tableName: "Reading")
                        .font(.headline)
                    Text("Count a dhikr of your choice, or count freely", tableName: "Reading")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    if today > 0 {
                        Text("Today: \(locale.number(today))", tableName: "Reading")
                            .font(.subheadline)
                            .monospacedDigit()
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .padding(.vertical, 4)
        }
        .accessibilityElement(children: .combine)
    }
}
