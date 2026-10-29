import AzkarKit
import SwiftUI

/// The month calendar: each day shows its five prayers, the morning and evening azkar and a
/// fast; a day that has begun opens in full. Months page with the arrows or a swipe, never past
/// today's month.
struct TrackerCalendarSection: View {
    let data: TrackerData
    /// `nil` follows today's month.
    @Binding var month: GregorianMonth?
    let open: (DayKey) -> Void
    @Environment(\.trackerFormat) private var format
    @Environment(\.layoutDirection) private var layoutDirection
    @State private var forward = true

    var body: some View {
        let current = GregorianMonth(data.today)
        let shown = month.map { min($0, current) } ?? current
        Section {
            VStack(spacing: 12) {
                header(shown: shown, current: current)
                TrackerMonthGrid(data: data, month: shown, open: open)
                    .id(shown)
                    .transition(.asymmetric(
                        insertion: .move(edge: forward ? .trailing : .leading).combined(with: .opacity),
                        removal: .move(edge: forward ? .leading : .trailing).combined(with: .opacity)
                    ))
            }
            .padding(.vertical, 6)
            .clipped()
            .contentShape(.rect)
            .gesture(DragGesture(minimumDistance: 24).onEnded { value in
                guard abs(value.translation.width) > abs(value.translation.height) else { return }
                // Swiping towards the start of the line goes forward in time.
                let towardsStart = layoutDirection == .leftToRight ? value.translation.width < 0 : value.translation.width > 0
                move(from: shown, by: towardsStart ? 1 : -1, current: current)
            })
            .sensoryFeedback(.selection, trigger: shown)

            TrackerCalendarLegend()
        } header: {
            Text("Calendar", tableName: "Tracker")
        }
    }

    private func header(shown: GregorianMonth, current: GregorianMonth) -> some View {
        HStack {
            Button {
                move(from: shown, by: -1, current: current)
            } label: {
                Image(systemName: "chevron.backward")
                    .font(.body.weight(.semibold))
                    .frame(width: 44, height: 44)
            }
            .accessibilityLabel(Text("Previous month", tableName: "Tracker"))

            Spacer(minLength: 4)
            VStack(spacing: 2) {
                Text(format.monthTitle(shown))
                    .font(.headline)
                Text(format.hijriSpan(shown))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .multilineTextAlignment(.center)
            .accessibilityElement(children: .combine)
            .accessibilityAddTraits(.isHeader)
            Spacer(minLength: 4)

            if shown < current {
                Button {
                    forward = true
                    withAnimation(.snappy) { month = nil }
                } label: {
                    Text("Today", tableName: "Tracker")
                        .font(.subheadline.weight(.medium))
                }
                .accessibilityLabel(Text("Back to this month", tableName: "Tracker"))
            }
            Button {
                move(from: shown, by: 1, current: current)
            } label: {
                Image(systemName: "chevron.forward")
                    .font(.body.weight(.semibold))
                    .frame(width: 44, height: 44)
            }
            .disabled(shown >= current)
            .accessibilityLabel(Text("Next month", tableName: "Tracker"))
        }
        .buttonStyle(.borderless)
    }

    private func move(from shown: GregorianMonth, by step: Int, current: GregorianMonth) {
        let target = shown.adding(months: step)
        guard target <= current else { return }
        forward = step > 0
        withAnimation(.snappy) { month = target == current ? nil : target }
    }
}

/// The days of one month under a localized weekday header, the week starting where the user's
/// region starts it.
private struct TrackerMonthGrid: View {
    let data: TrackerData
    let month: GregorianMonth
    let open: (DayKey) -> Void
    @Environment(\.trackerFormat) private var format

    var body: some View {
        let columns = Array(repeating: GridItem(.flexible(), spacing: 2), count: 7)
        let leading = (month.firstDay.weekday - format.firstWeekday + 7) % 7
        let short = format.weekdaySymbols(short: true)
        let long = format.weekdaySymbols(short: false)
        LazyVGrid(columns: columns, spacing: 6) {
            ForEach(0..<7, id: \.self) { index in
                Text(short[index])
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity)
                    .accessibilityLabel(long[index])
            }
            ForEach(0..<leading, id: \.self) { _ in
                Color.clear.frame(height: 1).accessibilityHidden(true)
            }
            ForEach(month.days, id: \.self) { day in
                TrackerDayCell(data: data, day: day) { open(day) }
            }
        }
        .dynamicTypeSize(...DynamicTypeSize.xxLarge)
    }
}
