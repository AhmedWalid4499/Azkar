import AppIntents
import AzkarKit
import SwiftUI
import WidgetKit

// The prayer widget's views, by family. Shared with the app so debug builds can render them.

struct PrayerTimesWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: PrayerTimesEntry

    var body: some View {
        if let board = entry.board, let next = board.next {
            switch family {
            case .systemSmall: WidgetSmallView(board: board, next: next, language: entry.language)
            case .systemMedium: WidgetMediumView(board: board, next: next, language: entry.language)
            case .systemLarge: WidgetLargeView(entry: entry, board: board, next: next)
            case .accessoryCircular: WidgetCircularView(board: board, next: next, language: entry.language)
            case .accessoryRectangular: WidgetRectangularView(board: board, next: next, language: entry.language)
            case .accessoryInline: WidgetInlineView(board: board, next: next, language: entry.language)
            default: WidgetSmallView(board: board, next: next, language: entry.language)
            }
        } else {
            switch family {
            case .accessoryInline, .accessoryCircular, .accessoryRectangular:
                Label {
                    Text(verbatim: SystemText.string("Set your location", entry.language))
                } icon: {
                    Image(systemName: "location.slash")
                }
            default:
                WidgetNoLocationView(language: entry.language)
            }
        }
    }
}

struct WidgetSmallView: View {
    let board: SystemPrayerBoard
    let next: UpcomingPrayer
    let language: SystemLanguage

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            WidgetNextPrayerSummary(board: board, next: next, language: language)
            Spacer(minLength: 0)
            WidgetLoggedCount(board: board, language: language)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        // Larger text would push the countdown out of the square.
        .dynamicTypeSize(...DynamicTypeSize.large)
    }
}

struct WidgetMediumView: View {
    let board: SystemPrayerBoard
    let next: UpcomingPrayer
    let language: SystemLanguage

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            VStack(alignment: .leading, spacing: 0) {
                WidgetNextPrayerSummary(board: board, next: next, language: language)
                Spacer(minLength: 0)
                WidgetLoggedCount(board: board, language: language)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            WidgetPrayerRows(board: board, language: language, spacing: 3)
                .frame(maxWidth: .infinity)
        }
        .dynamicTypeSize(...DynamicTypeSize.large)
    }
}

struct WidgetLargeView: View {
    let entry: PrayerTimesEntry
    let board: SystemPrayerBoard
    let next: UpcomingPrayer

    var body: some View {
        let language = entry.language
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top) {
                WidgetNextPrayerSummary(board: board, next: next, language: language)
                Spacer(minLength: 8)
                if !board.placeName.isEmpty {
                    Label {
                        Text(verbatim: board.placeName).lineLimit(1)
                    } icon: {
                        Image(systemName: "location.fill")
                    }
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                }
            }
            Divider()
            WidgetPrayerRows(board: board, language: language, spacing: 4)
                .font(.subheadline)
            if !entry.azkar.isEmpty {
                Divider()
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(entry.azkar) { progress in
                        Link(destination: SystemRoute.azkar(progress.session).url) {
                            WidgetAzkarProgressRow(progress: progress, language: language)
                                .foregroundStyle(.primary)
                        }
                    }
                }
            }
            Spacer(minLength: 0)
        }
        // The 6.3-inch iPhones' large widget is 354 points tall: larger text would overflow it.
        .dynamicTypeSize(...DynamicTypeSize.large)
    }
}

/// "3 of 5 logged".
struct WidgetLoggedCount: View {
    let board: SystemPrayerBoard
    let language: SystemLanguage

    var body: some View {
        let logged = board.rows.filter(\.isLogged).count
        let count = SystemText.number(logged, language)
        let total = SystemText.number(board.rows.count, language)
        HStack(spacing: 4) {
            Image(systemName: "checkmark.circle")
            Text(verbatim: SystemText.format("%1$@ of %2$@ logged", language, count, total))
        }
        .font(.caption2)
        .foregroundStyle(.secondary)
    }
}

/// A session's progress today, opening the reader there.
struct WidgetAzkarProgressRow: View {
    let progress: PrayerTimesEntry.SessionProgress
    let language: SystemLanguage

    var body: some View {
        let name = SystemText.session(progress.session, language)
        let counts = SystemText.format("%1$@/%2$@", language, SystemText.number(progress.done, language), SystemText.number(progress.total, language))
        HStack(spacing: 8) {
            Image(systemName: progress.completed ? "checkmark.seal.fill" : symbol)
                .foregroundStyle(progress.completed ? AnyShapeStyle(.tint) : AnyShapeStyle(.secondary))
                .widgetAccentable(progress.completed)
                .frame(width: 18)
            Text(verbatim: name)
                .lineLimit(1)
            Spacer(minLength: 4)
            WidgetProgressBar(fraction: progress.fraction)
                .frame(width: 60)
            Text(verbatim: counts)
                .monospacedDigit()
                .foregroundStyle(.secondary)
        }
        .font(.footnote)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(verbatim: progress.completed
            ? SystemText.format("%@: completed", language, name)
            : SystemText.format("%1$@: %2$@ read", language, name, counts)))
    }

    private var symbol: String {
        switch progress.session {
        case .morning: "sunrise"
        case .evening: "sunset"
        case .sleep: "bed.double"
        case .afterPrayer: "hands.sparkles"
        }
    }
}

// MARK: Lock Screen

struct WidgetCircularView: View {
    let board: SystemPrayerBoard
    let next: UpcomingPrayer
    let language: SystemLanguage

    var body: some View {
        let since = min(board.previous?.at ?? next.at.addingTimeInterval(-6 * 3600), board.now)
        ProgressView(timerInterval: since...max(since, next.at), countsDown: true) {
            Text(verbatim: SystemText.prayer(next.prayer, language, on: next.day))
        } currentValueLabel: {
            VStack(spacing: 0) {
                Image(systemName: next.prayer.symbolName)
                    .font(.caption)
                Text(verbatim: SystemText.clock(next.at, in: board.place.timeZone, language))
                    .font(.system(size: 11, weight: .semibold))
                    .minimumScaleFactor(0.6)
            }
        }
        .progressViewStyle(.circular)
        .widgetAccentable()
        .dynamicTypeSize(...DynamicTypeSize.large)
        .accessibilityLabel(Text(verbatim: SystemText.format("%1$@ at %2$@", language, SystemText.prayer(next.prayer, language, on: next.day), SystemText.time(next.at, in: board.place.timeZone, language))))
    }
}

struct WidgetRectangularView: View {
    let board: SystemPrayerBoard
    let next: UpcomingPrayer
    let language: SystemLanguage

    var body: some View {
        VStack(alignment: .leading, spacing: 1) {
            Label {
                Text(verbatim: SystemText.prayer(next.prayer, language, on: next.day))
            } icon: {
                Image(systemName: next.prayer.symbolName)
            }
            .font(.headline)
            .widgetAccentable()
            Text(verbatim: SystemText.time(next.at, in: board.place.timeZone, language))
                .font(.subheadline)
            Text(timerInterval: board.now...max(board.now, next.at), countsDown: true)
                .font(.subheadline.monospacedDigit())
                .foregroundStyle(.secondary)
        }
        .lineLimit(1)
        .minimumScaleFactor(0.8)
        .frame(maxWidth: .infinity, alignment: .leading)
        // Three lines fill the Lock Screen's space: larger text would cut off the countdown.
        .dynamicTypeSize(...DynamicTypeSize.large)
        .accessibilityElement(children: .combine)
    }
}

struct WidgetInlineView: View {
    let board: SystemPrayerBoard
    let next: UpcomingPrayer
    let language: SystemLanguage

    var body: some View {
        Label {
            Text(verbatim: SystemText.format("%1$@ %2$@", language, SystemText.prayer(next.prayer, language, on: next.day), SystemText.time(next.at, in: board.place.timeZone, language)))
        } icon: {
            Image(systemName: next.prayer.symbolName)
        }
    }
}

// MARK: Today's prayers

/// The "Today's prayers" widget: the day, and its five prayers to tick off as they are prayed.
struct TodayPrayersWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: PrayerTimesEntry

    var body: some View {
        if let board = entry.board {
            switch family {
            case .accessoryRectangular: TodayPrayersRectangularView(board: board, language: entry.language, hijriOffset: entry.hijriOffset)
            case .accessoryCircular: TodayPrayersCircularView(board: board, language: entry.language)
            case .accessoryInline: TodayPrayersInlineView(board: board, language: entry.language)
            default: TodayPrayersSmallView(board: board, language: entry.language, hijriOffset: entry.hijriOffset)
            }
        } else {
            switch family {
            case .accessoryInline, .accessoryCircular, .accessoryRectangular:
                Label {
                    Text(verbatim: SystemText.string("Set your location", entry.language))
                } icon: {
                    Image(systemName: "location.slash")
                }
            default:
                WidgetNoLocationView(language: entry.language)
            }
        }
    }
}

/// The date the five prayers are of, Gregorian and Hijri.
private func todayLine(_ board: SystemPrayerBoard, _ language: SystemLanguage, hijriOffset: Int) -> String {
    let day = board.rows.first?.day ?? board.today
    return "\(SystemText.shortDay(day, language))\(SystemText.separator(language))\(SystemText.hijriDay(day, offset: hijriOffset, language))"
}

/// Lock Screen: the date over the five prayers, each a mark to tap once its time has come.
struct TodayPrayersRectangularView: View {
    let board: SystemPrayerBoard
    let language: SystemLanguage
    let hijriOffset: Int

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(verbatim: todayLine(board, language, hijriOffset: hijriOffset))
                .font(.caption.weight(.semibold))
                .lineLimit(1)
                .minimumScaleFactor(0.7)
                .widgetAccentable()
            // Each mark as wide as its name, the room left shared between them: equal columns would
            // squeeze Maghrib (and Jumu'ah) into smaller type than the others.
            HStack(spacing: 0) {
                ForEach(Array(board.rows.enumerated()), id: \.element.id) { index, row in
                    if index > 0 { Spacer(minLength: 2) }
                    TodayPrayerMark(row: row, board: board, language: language)
                        .fixedSize()
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .dynamicTypeSize(...DynamicTypeSize.large)
    }
}

/// One prayer as a mark over its name; tapping it marks it prayed on time once its time has come.
struct TodayPrayerMark: View {
    let row: SystemPrayerBoard.Row
    let board: SystemPrayerBoard
    let language: SystemLanguage

    var body: some View {
        let canTick = !row.isLogged && row.hasBegun(at: board.now)
        Group {
            if canTick {
                Button(intent: TickPrayerIntent(prayer: row.prayer, day: row.day)) { content(canTick: true) }
                    .buttonStyle(.plain)
            } else {
                content(canTick: false)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(verbatim: label(canTick: canTick)))
    }

    private func content(canTick: Bool) -> some View {
        let isNext = board.next?.prayer == row.prayer && board.next?.day == row.day
        return VStack(spacing: 1) {
            Image(systemName: row.status?.symbolName ?? (canTick ? "circle" : "circle.dotted"))
                .font(.title3)
                .widgetAccentable(row.isLogged)
                .contentTransition(.symbolEffect(.replace))
            Text(verbatim: SystemText.prayer(row.prayer, language, on: row.day))
                .font(.system(size: 10, weight: isNext ? .semibold : .regular))
                .lineLimit(1)
        }
        .foregroundStyle(row.isLogged || canTick ? .primary : .secondary)
        .contentShape(.rect)
    }

    private func label(canTick: Bool) -> String {
        let name = SystemText.prayer(row.prayer, language, on: row.day)
        if let status = row.status { return SystemText.format("%1$@, %2$@: %3$@", language, name, row.at.map { SystemText.time($0, in: board.place.timeZone, language) } ?? "", SystemText.status(status, language)) }
        let time = row.at.map { SystemText.time($0, in: board.place.timeZone, language) } ?? ""
        return canTick ? SystemText.format("%1$@, %2$@: not logged. Mark as prayed on time.", language, name, time) : SystemText.format("%1$@, %2$@", language, name, time)
    }
}

/// Lock Screen: how many of the day's five prayers are logged, as a ring.
struct TodayPrayersCircularView: View {
    let board: SystemPrayerBoard
    let language: SystemLanguage

    var body: some View {
        let logged = board.rows.filter(\.isLogged).count
        Gauge(value: Double(logged), in: 0...Double(max(board.rows.count, 1))) {
            Image(systemName: "checkmark")
        } currentValueLabel: {
            Text(verbatim: SystemText.format("%1$@/%2$@", language, SystemText.number(logged, language), SystemText.number(board.rows.count, language)))
                .font(.system(size: 14, weight: .semibold))
                .minimumScaleFactor(0.6)
        }
        .gaugeStyle(.accessoryCircularCapacity)
        .widgetAccentable()
        .dynamicTypeSize(...DynamicTypeSize.large)
        .accessibilityLabel(Text(verbatim: SystemText.format("%1$@ of %2$@ logged", language, SystemText.number(logged, language), SystemText.number(board.rows.count, language))))
    }
}

/// Lock Screen, above the clock: how many are logged, and the next prayer.
struct TodayPrayersInlineView: View {
    let board: SystemPrayerBoard
    let language: SystemLanguage

    var body: some View {
        let logged = board.rows.filter(\.isLogged).count
        let count = SystemText.format("%1$@/%2$@", language, SystemText.number(logged, language), SystemText.number(board.rows.count, language))
        Label {
            if let next = board.next {
                Text(verbatim: "\(count)\(SystemText.separator(language))\(SystemText.prayer(next.prayer, language, on: next.day)) \(SystemText.time(next.at, in: board.place.timeZone, language))")
            } else {
                Text(verbatim: count)
            }
        } icon: {
            Image(systemName: "checkmark.circle")
        }
    }
}

/// Home Screen: the date over the five prayers with their times, each one to tick.
struct TodayPrayersSmallView: View {
    let board: SystemPrayerBoard
    let language: SystemLanguage
    let hijriOffset: Int

    var body: some View {
        let day = board.rows.first?.day ?? board.today
        VStack(alignment: .leading, spacing: 4) {
            VStack(alignment: .leading, spacing: 0) {
                Text(verbatim: SystemText.shortDay(day, language))
                    .font(.subheadline.weight(.semibold))
                Text(verbatim: SystemText.hijriDay(day, offset: hijriOffset, language))
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            .lineLimit(1)
            .minimumScaleFactor(0.7)
            Spacer(minLength: 0)
            // Times without AM/PM, so a name as long as Maghrib or Jumu'ah keeps its room.
            WidgetPrayerRows(board: board, language: language, spacing: 0, compact: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .dynamicTypeSize(...DynamicTypeSize.large)
    }
}

