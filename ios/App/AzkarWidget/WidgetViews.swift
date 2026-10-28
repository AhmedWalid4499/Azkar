import SwiftUI
import WidgetKit

struct PrayerTimesEntryView: View {
    @Environment(\.widgetFamily) private var family
    let entry: PrayerEntry

    var body: some View {
        WidgetView(entry: entry, family: family)
    }
}

/// One family's widget, in the app's language, direction and digits.
struct WidgetView: View {
    let entry: PrayerEntry
    let family: WidgetFamily

    var body: some View {
        content
            .environment(\.layoutDirection, entry.text.isArabic ? .rightToLeft : .leftToRight)
            .environment(\.locale, entry.text.locale)
    }

    @ViewBuilder
    private var content: some View {
        switch family {
        case .accessoryCircular:
            CircularView(entry: entry).accessoryBackground(circular: true)
        case .accessoryRectangular:
            RectangularView(entry: entry).accessoryBackground(circular: false)
        case .systemMedium:
            MediumView(entry: entry).widgetBackground(Palette.background)
        default:
            SmallView(entry: entry).widgetBackground(Palette.background)
        }
    }
}

/// The next prayer, its time and a live countdown.
struct SmallView: View {
    let entry: PrayerEntry

    var body: some View {
        if case let .ready(next, tomorrow, _) = entry.content {
            VStack(alignment: .leading, spacing: 2) {
                Text(entry.text.label("nextPrayer"))
                    .font(.caption.weight(.medium))
                    .foregroundStyle(Palette.inkSecondary)
                Spacer(minLength: 0)
                NextPrayerSummary(entry: entry, next: next, tomorrow: tomorrow, nameFont: .title.weight(.semibold))
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
            .accessibilityElement(children: .combine)
        } else {
            MessageView(entry: entry)
        }
    }
}

/// The next prayer beside today's five, each showing whether it is logged. On iOS 17 and
/// later an unlogged one is marked prayed with a tap.
struct MediumView: View {
    private static let gap: CGFloat = 12
    let entry: PrayerEntry

    var body: some View {
        if case let .ready(next, tomorrow, today) = entry.content {
            GeometryReader { geometry in
                HStack(alignment: .top, spacing: Self.gap) {
                    VStack(alignment: .leading, spacing: 2) {
                        if let greeting = entry.text.greeting {
                            Text(greeting)
                                .font(.caption2)
                                .foregroundStyle(Palette.inkSecondary)
                                .lineLimit(1)
                                .minimumScaleFactor(0.7)
                        }
                        Text(entry.text.label("nextPrayer"))
                            .font(.caption.weight(.medium))
                            .foregroundStyle(Palette.inkSecondary)
                        Spacer(minLength: 0)
                        NextPrayerSummary(entry: entry, next: next, tomorrow: tomorrow, nameFont: .title2.weight(.semibold))
                    }
                    .frame(width: (geometry.size.width - Self.gap) * 0.4, alignment: .leading)
                    .frame(maxHeight: .infinity, alignment: .leading)
                    .accessibilityElement(children: .combine)

                    VStack(spacing: 2) {
                        ForEach(today) { slot in
                            PrayerRow(slot: slot, isNext: slot.id == next.id, text: entry.text)
                        }
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }
        } else {
            MessageView(entry: entry)
        }
    }
}

struct NextPrayerSummary: View {
    let entry: PrayerEntry
    let next: PrayerSlot
    let tomorrow: Bool
    let nameFont: Font

    var body: some View {
        Text(entry.text.prayer(next.prayer))
            .font(nameFont)
            .foregroundStyle(Palette.primary)
            .lineLimit(1)
            .minimumScaleFactor(0.6)
        Text(tomorrow ? "\(entry.text.label("tomorrow")) · \(next.time)" : next.time)
            .font(.subheadline)
            .foregroundStyle(Palette.ink)
            .lineLimit(1)
            .minimumScaleFactor(0.7)
        Countdown(from: entry.date, to: next.at, label: entry.text.label("countdown"))
            .font(.title3.weight(.medium))
            .foregroundStyle(Palette.ink)
    }
}

struct PrayerRow: View {
    let slot: PrayerSlot
    let isNext: Bool
    let text: WidgetText

    var body: some View {
        if slot.status == nil, #available(iOS 17.0, *) {
            Button(intent: MarkPrayedIntent(date: slot.date, prayer: slot.prayer)) { row }
                .buttonStyle(.plain)
                .accessibilityLabel(text.rowLabel(slot))
        } else {
            row
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(text.rowLabel(slot))
        }
    }

    private var row: some View {
        HStack(spacing: 6) {
            Text(text.prayer(slot.prayer))
                .fontWeight(isNext ? .semibold : .regular)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
            Spacer(minLength: 4)
            Text(slot.time)
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            Image(systemName: StatusSymbol.name(for: slot.status))
                .foregroundStyle(slot.status.map(Palette.status) ?? Palette.inkSecondary)
                .frame(width: 18)
        }
        .font(.footnote)
        .foregroundStyle(isNext ? Palette.primary : Palette.ink)
        .padding(.horizontal, 6)
        .frame(maxHeight: .infinity)
        .background {
            if isNext {
                RoundedRectangle(cornerRadius: 6, style: .continuous).fill(Palette.primarySoft)
            }
        }
        .contentShape(Rectangle())
    }
}

/// Lock screen: the next prayer, its time and the countdown.
struct RectangularView: View {
    let entry: PrayerEntry

    var body: some View {
        if case let .ready(next, tomorrow, _) = entry.content {
            VStack(alignment: .leading, spacing: 0) {
                Text(tomorrow ? "\(entry.text.label("nextPrayer")) · \(entry.text.label("tomorrow"))" : entry.text.label("nextPrayer"))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                HStack(spacing: 4) {
                    Text(entry.text.prayer(next.prayer)).widgetAccentable()
                    Text(next.time)
                }
                .font(.headline)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
                Countdown(from: entry.date, to: next.at, label: entry.text.label("countdown"))
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityElement(children: .combine)
        } else {
            Text(message(for: entry))
                .font(.caption)
                .lineLimit(3)
                .minimumScaleFactor(0.7)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

/// Lock screen: the next prayer and its time.
struct CircularView: View {
    let entry: PrayerEntry

    var body: some View {
        if case let .ready(next, _, _) = entry.content {
            VStack(spacing: 0) {
                Text(entry.text.prayer(next.prayer))
                    .font(.system(size: 12, weight: .semibold))
                    .widgetAccentable()
                Text(next.time)
                    .font(.system(size: 13, weight: .medium))
                    .monospacedDigit()
            }
            .lineLimit(1)
            .minimumScaleFactor(0.5)
            .padding(4)
            .accessibilityElement(children: .combine)
        } else {
            Image(systemName: "moon.stars")
                .font(.title3)
                .accessibilityLabel(message(for: entry))
        }
    }
}

/// What a widget says when it has no prayer to show.
struct MessageView: View {
    let entry: PrayerEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Image(systemName: "moon.stars")
                .font(.title3)
                .foregroundStyle(Palette.primary)
                .accessibilityHidden(true)
            Text(message(for: entry))
                .font(.footnote)
                .foregroundStyle(Palette.ink)
                .minimumScaleFactor(0.8)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

func message(for entry: PrayerEntry) -> String {
    switch entry.content {
    case .noLocation: return entry.text.label("noLocation")
    case .outOfDate: return entry.text.label("stale")
    default: return entry.text.label("notSetUp")
    }
}

/// Counts down to `to` by itself, between timeline entries.
struct Countdown: View {
    let from: Date
    let to: Date
    let label: String

    var body: some View {
        let range = min(from, to)...to
        Text(timerInterval: range, countsDown: true)
            .monospacedDigit()
            .multilineTextAlignment(.leading)
            .lineLimit(1)
            .accessibilityLabel(Text(label))
            .accessibilityValue(Text(timerInterval: range, countsDown: true))
    }
}

extension View {
    /// Lock-screen widgets: the system's round backdrop for the circular one, none for the other.
    @ViewBuilder
    func accessoryBackground(circular: Bool) -> some View {
        if #available(iOS 17.0, *) {
            containerBackground(for: .widget) {
                if circular { AccessoryWidgetBackground() } else { Color.clear }
            }
        } else if circular {
            background(AccessoryWidgetBackground())
        } else {
            self
        }
    }
}
