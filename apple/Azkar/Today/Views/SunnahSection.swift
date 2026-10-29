import AzkarKit
import SwiftUI

/// Today's sunnah prayers, one tap each. Between midnight and Fajr the prayers of the night
/// still count for the night that is ending, so they are set apart under the day they are filed
/// for, like last night's Isha. Folds down to its heading and remembers it.
struct SunnahSection: View {
    @Environment(AppEnvironment.self) private var app
    @Environment(\.todayFormat) private var format
    @Environment(\.dynamicTypeSize) private var typeSize
    @AppStorage("today.sunnahExpanded") private var expanded = true
    let context: TodayContext

    var body: some View {
        let filed = SunnahPrayer.allCases.map { ($0, Night.sunnahDay($0, today: context.today, beforeDawn: context.beforeDawn)) }
        let ofToday = filed.filter { $0.1 == context.today }
        let ofLastNight = filed.filter { $0.1 != context.today }
        let done = filed.filter { isDone($0.0, on: $0.1) }.count

        Section {
            DisclosureGroup(isExpanded: $expanded.animation(.snappy)) {
                VStack(alignment: .leading, spacing: 12) {
                    chips(ofToday)
                    if !ofLastNight.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            Label {
                                VStack(alignment: .leading, spacing: 1) {
                                    Text(L("Last night")).font(.subheadline.weight(.semibold))
                                    Text(L("Counts for \(format.weekdayAndDate(context.yesterday))"))
                                        .font(.footnote)
                                        .foregroundStyle(.secondary)
                                }
                            } icon: {
                                Image(systemName: "moon.stars.fill").foregroundStyle(.indigo)
                            }
                            .accessibilityElement(children: .combine)
                            .accessibilityAddTraits(.isHeader)
                            chips(ofLastNight)
                        }
                    }
                }
                .padding(.vertical, 6)
            } label: {
                let header = typeSize.isAccessibilitySize
                    ? AnyLayout(VStackLayout(alignment: .leading, spacing: 2))
                    : AnyLayout(HStackLayout())
                header {
                    HStack(spacing: 10) {
                        Image(systemName: "sparkles").foregroundStyle(.tint).accessibilityHidden(true)
                        Text(L("Sunnah prayers"))
                    }
                    .font(.body.weight(.semibold))
                    if !typeSize.isAccessibilitySize { Spacer() }
                    Text(L("\(done) of \(filed.count)"))
                        .font(.subheadline)
                        .monospacedDigit()
                        .foregroundStyle(.secondary)
                        .contentTransition(.numericText())
                }
                .accessibilityElement(children: .combine)
            }
            .id("today.sunnah")
        }
    }

    private func chips(_ items: [(SunnahPrayer, DayKey)]) -> some View {
        FlowLayout(spacing: 8) {
            ForEach(items, id: \.0) { sunnah, day in
                SunnahChip(sunnah: sunnah, day: day, done: isDone(sunnah, on: day))
            }
        }
    }

    private func isDone(_ sunnah: SunnahPrayer, on day: DayKey) -> Bool {
        app.records.records.prayers[day]?.sunnah[sunnah] != nil
    }
}

/// One sunnah prayer as a toggle.
private struct SunnahChip: View {
    @Environment(AppEnvironment.self) private var app
    let sunnah: SunnahPrayer
    let day: DayKey
    let done: Bool
    @State private var ticks = 0

    var body: some View {
        Toggle(isOn: Binding(get: { done }, set: set)) {
            HStack(spacing: 5) {
                Image(systemName: done ? "checkmark.circle.fill" : "circle")
                    .contentTransition(.symbolEffect(.replace))
                    .accessibilityHidden(true)
                Text(sunnah.title)
            }
            .font(.subheadline.weight(.medium))
        }
        .toggleStyle(.button)
        .buttonStyle(.bordered)
        .buttonBorderShape(.capsule)
        .controlSize(.small)
        .tint(done ? .accentColor : .secondary)
        .sensoryFeedback(.selection, trigger: ticks)
    }

    private func set(_ on: Bool) {
        Task {
            do {
                if try await app.records.setSunnah(sunnah, done: on, on: day) == .changed { ticks += 1 }
            } catch {
                print("Today: setting \(sunnah) on \(day) failed: \(error)")
            }
        }
    }
}

/// Lays its children out in lines, wrapping as the width runs out (the leading edge follows
/// the layout direction).
struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let rows = arrange(width: proposal.width ?? .infinity, subviews: subviews)
        let height = rows.last.map { $0.y + $0.height } ?? 0
        let width = rows.map(\.width).max() ?? 0
        return CGSize(width: proposal.width ?? width, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        for row in arrange(width: bounds.width, subviews: subviews) {
            var x = bounds.minX
            for index in row.indices {
                let size = subviews[index].sizeThatFits(ProposedViewSize(width: bounds.width, height: nil))
                subviews[index].place(at: CGPoint(x: x, y: bounds.minY + row.y), proposal: ProposedViewSize(width: min(size.width, bounds.width), height: size.height))
                x += min(size.width, bounds.width) + spacing
            }
        }
    }

    private struct Row {
        var indices: [Int] = []
        var y: CGFloat = 0
        var width: CGFloat = 0
        var height: CGFloat = 0
    }

    private func arrange(width: CGFloat, subviews: Subviews) -> [Row] {
        var rows: [Row] = []
        var row = Row()
        for index in subviews.indices {
            let size = subviews[index].sizeThatFits(ProposedViewSize(width: width, height: nil))
            let itemWidth = min(size.width, width)
            if !row.indices.isEmpty, row.width + spacing + itemWidth > width {
                rows.append(row)
                row = Row(y: row.y + row.height + spacing)
            }
            row.width += (row.indices.isEmpty ? 0 : spacing) + itemWidth
            row.height = max(row.height, size.height)
            row.indices.append(index)
        }
        if !row.indices.isEmpty { rows.append(row) }
        return rows
    }
}
