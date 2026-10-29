import AzkarKit
import SwiftUI

/// What the calendar's marks mean.
struct TrackerCalendarLegend: View {
    @Environment(\.trackerFormat) private var format
    @State private var expanded = false

    var body: some View {
        DisclosureGroup(isExpanded: $expanded) {
            VStack(alignment: .leading, spacing: 8) {
                Text("Five marks per day, Fajr to Isha", tableName: "Tracker")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                ForEach(PrayerStatus.pickerOrder, id: \.self) { status in
                    entry(status.trackerMark, tint: status.trackerTint, size: 9) { format.text(status.trackerName) }
                }
                entry(TrackerUnloggedPrayer.mark, tint: .secondary, size: 9) { format.text(TrackerUnloggedPrayer.name) }
                Divider()
                entry(TrackerMark.morning, tint: AzkarSession.morning.trackerTint, size: 12) { Text("Morning azkar completed", tableName: "Tracker") }
                entry(TrackerMark.evening, tint: AzkarSession.evening.trackerTint, size: 12) { Text("Evening azkar completed", tableName: "Tracker") }
                entry(TrackerMark.fast, tint: .pink, size: 12) { Text("Fast kept", tableName: "Tracker") }
            }
            .padding(.vertical, 4)
        } label: {
            Label { Text("Key", tableName: "Tracker") } icon: { Image(systemName: "info.circle") }
        }
    }

    private func entry(_ symbol: String, tint: Color, size: CGFloat, @ViewBuilder label: () -> Text) -> some View {
        HStack(spacing: 10) {
            Image(systemName: symbol)
                .font(.system(size: size, weight: .heavy))
                .foregroundStyle(tint)
                .frame(width: 20)
                .accessibilityHidden(true)
            label().font(.subheadline)
        }
    }
}
