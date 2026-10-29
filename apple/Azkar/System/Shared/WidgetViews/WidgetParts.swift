import AppIntents
import AzkarKit
import SwiftUI
import WidgetKit

/// The widget's background: a soft wash of the app's green over the system background. Removed by
/// the system in StandBy and on tinted Home Screens.
struct WidgetBackdrop: View {
    var body: some View {
        LinearGradient(
            colors: [Color.azkarAccent.opacity(0.22), Color.azkarAccent.opacity(0.05)],
            startPoint: .topLeading, endPoint: .bottomTrailing
        )
        .background(Color(uiColor: .systemBackground))
    }
}

/// "Next prayer", the prayer and its time, and the countdown to it.
struct WidgetNextPrayerSummary: View {
    let board: SystemPrayerBoard
    let next: UpcomingPrayer
    let language: SystemLanguage
    var compact = false

    var body: some View {
        let name = SystemText.prayer(next.prayer, language)
        let time = SystemText.time(next.at, in: board.place.timeZone, language)
        VStack(alignment: .leading, spacing: compact ? 2 : 4) {
            Label {
                Text(verbatim: board.nextIsTomorrow ? SystemText.string("Tomorrow", language) : SystemText.string("Next prayer", language))
            } icon: {
                Image(systemName: next.prayer.symbolName)
            }
            .font(.caption.weight(.semibold))
            .foregroundStyle(.tint)
            .widgetAccentable()

            Text(verbatim: name)
                .font(compact ? .title3.weight(.bold) : .title2.weight(.bold))
                .minimumScaleFactor(0.7)
                .lineLimit(1)
            Text(verbatim: time)
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Text(timerInterval: board.now...max(board.now, next.at), countsDown: true)
                .font(.title3.monospacedDigit().weight(.semibold))
                .contentTransition(.numericText(countsDown: true))
                .lineLimit(1)
                .accessibilityLabel(Text(verbatim: SystemText.string("Time remaining", language)))
        }
        .accessibilityElement(children: .combine)
    }
}

/// One of today's prayers: tapping it when its time has come and it is not logged marks it prayed on time.
struct WidgetPrayerRow: View {
    let row: SystemPrayerBoard.Row
    let board: SystemPrayerBoard
    let language: SystemLanguage
    var isNext = false

    var body: some View {
        let canTick = !row.isLogged && row.hasBegun(at: board.now)
        Group {
            if canTick {
                Button(intent: TickPrayerIntent(prayer: row.prayer, day: row.day)) {
                    content(canTick: true)
                }
                .buttonStyle(.plain)
            } else {
                content(canTick: false)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(verbatim: accessibilityText))
    }

    private func content(canTick: Bool) -> some View {
        HStack(spacing: 6) {
            Image(systemName: row.status?.symbolName ?? (canTick ? "circle" : "circle.dotted"))
                .foregroundStyle(row.isLogged ? AnyShapeStyle(.tint) : AnyShapeStyle(.secondary))
                .widgetAccentable(row.isLogged)
                .contentTransition(.symbolEffect(.replace))
            Text(verbatim: SystemText.prayer(row.prayer, language))
                .fontWeight(isNext ? .bold : .regular)
                .lineLimit(1)
            Spacer(minLength: 4)
            Text(verbatim: row.at.map { SystemText.time($0, in: board.place.timeZone, language) } ?? "—")
                .monospacedDigit()
                .foregroundStyle(isNext ? .primary : .secondary)
                .lineLimit(1)
        }
        .font(.footnote)
        .contentShape(.rect)
    }

    private var accessibilityText: String {
        let name = SystemText.prayer(row.prayer, language)
        let time = row.at.map { SystemText.time($0, in: board.place.timeZone, language) } ?? ""
        if let status = row.status {
            return SystemText.format("%1$@, %2$@: %3$@", language, name, time, SystemText.status(status, language))
        }
        return row.hasBegun(at: board.now)
            ? SystemText.format("%1$@, %2$@: not logged. Mark as prayed on time.", language, name, time)
            : SystemText.format("%1$@, %2$@", language, name, time)
    }
}

/// The five prayers of today.
struct WidgetPrayerRows: View {
    let board: SystemPrayerBoard
    let language: SystemLanguage
    var spacing: CGFloat = 4

    var body: some View {
        VStack(alignment: .leading, spacing: spacing) {
            ForEach(board.rows) { row in
                WidgetPrayerRow(row: row, board: board, language: language, isNext: board.next?.prayer == row.prayer && board.next?.day == row.day)
            }
        }
    }
}

/// Shown until a place is saved.
struct WidgetNoLocationView: View {
    let language: SystemLanguage

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Image(systemName: "location.slash")
                .font(.title3)
                .foregroundStyle(.tint)
                .widgetAccentable()
            Text(verbatim: SystemText.string("Open Azkar and choose your location to see prayer times here.", language))
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

extension Color {
    /// The app's green, from each target's asset catalog.
    nonisolated static let azkarAccent = Color("AccentColor")
}

/// A thin bar for a fraction, drawn the same in widgets and anywhere else.
struct WidgetProgressBar: View {
    let fraction: Double

    var body: some View {
        Capsule()
            .fill(.tertiary)
            .overlay(alignment: .leading) {
                GeometryReader { proxy in
                    Capsule()
                        .fill(.tint)
                        .frame(width: max(proxy.size.height, proxy.size.width * min(1, max(0, fraction))))
                        .opacity(fraction > 0 ? 1 : 0)
                }
            }
            .frame(height: 5)
            .widgetAccentable()
    }
}

extension View {
    /// The interface language of the entry: its locale (digits, clock) and direction.
    func systemLanguage(_ language: SystemLanguage) -> some View {
        environment(\.locale, language.locale).environment(\.layoutDirection, language.layoutDirection)
    }
}
