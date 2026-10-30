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
        VStack(alignment: .leading, spacing: 10) {
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
            WidgetPrayerRows(board: board, language: language, spacing: 6)
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
        .dynamicTypeSize(...DynamicTypeSize.xLarge)
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
            Text(verbatim: SystemText.prayer(next.prayer, language))
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
        .accessibilityLabel(Text(verbatim: SystemText.format("%1$@ at %2$@", language, SystemText.prayer(next.prayer, language), SystemText.time(next.at, in: board.place.timeZone, language))))
    }
}

struct WidgetRectangularView: View {
    let board: SystemPrayerBoard
    let next: UpcomingPrayer
    let language: SystemLanguage

    var body: some View {
        VStack(alignment: .leading, spacing: 1) {
            Label {
                Text(verbatim: SystemText.prayer(next.prayer, language))
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
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }
}

struct WidgetInlineView: View {
    let board: SystemPrayerBoard
    let next: UpcomingPrayer
    let language: SystemLanguage

    var body: some View {
        Label {
            Text(verbatim: SystemText.format("%1$@ %2$@", language, SystemText.prayer(next.prayer, language), SystemText.time(next.at, in: board.place.timeZone, language)))
        } icon: {
            Image(systemName: next.prayer.symbolName)
        }
    }
}
