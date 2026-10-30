import AzkarCore
import SwiftUI

/// The next prayer with its countdown, then today's five: a tap ticks off one whose time has come.
struct WatchPrayersView: View {
    let store: WatchStore
    @Environment(\.locale) private var locale

    var body: some View {
        // Each minute is enough: the countdown runs by itself, this only moves the rows on.
        TimelineView(.everyMinute) { context in
            let now = context.date
            if let board = store.board, let today = board.day(at: now) {
                List {
                    if let next = board.next(after: now) {
                        Section { nextPrayer(next) }
                    }
                    Section {
                        ForEach(today.rows) { row in
                            WatchPrayerRow(row: row, day: today.day, board: board, now: now, store: store)
                        }
                    }
                }
            } else {
                ContentUnavailableView {
                    Label { Text("Open Azkar on your iPhone", tableName: "Watch") } icon: { Image(systemName: "iphone") }
                } description: {
                    Text("Your prayer times come from there.", tableName: "Watch")
                }
            }
        }
    }

    private func nextPrayer(_ next: WatchBoard.Upcoming) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(next.prayer.title)
                .font(.title3.weight(.semibold))
                .foregroundStyle(.tint)
            Text(timerInterval: .now...max(.now, next.at), countsDown: true)
                .font(.title2.monospacedDigit().weight(.medium))
        }
        .listRowBackground(Color.clear)
        .accessibilityElement(children: .combine)
    }
}

private struct WatchPrayerRow: View {
    let row: WatchBoard.Row
    let day: DayKey
    let board: WatchBoard
    let now: Date
    let store: WatchStore
    @Environment(\.locale) private var locale

    var body: some View {
        let ticked = store.isTicked(row.prayer, on: day)
        Button {
            store.tick(row.prayer, on: day)
        } label: {
            HStack(spacing: 8) {
                Image(systemName: symbol(ticked: ticked))
                    .foregroundStyle(row.status != nil || ticked ? AnyShapeStyle(.tint) : AnyShapeStyle(.secondary))
                Text(row.prayer.title)
                Spacer(minLength: 4)
                if let at = row.at {
                    Text(at, format: Date.FormatStyle(date: .omitted, time: .shortened, locale: locale, timeZone: board.zone))
                        .font(.footnote.monospacedDigit())
                        .foregroundStyle(.secondary)
                }
            }
        }
        .disabled(ticked || !board.canTick(row, at: now))
        .sensoryFeedback(.success, trigger: ticked) { _, ticked in ticked }
    }

    private func symbol(ticked: Bool) -> String {
        if ticked { return "checkmark.circle.fill" }
        switch row.status {
        case .ontime: return "checkmark.circle.fill"
        case .jamaah: return "person.2.circle.fill"
        case .late: return "clock.arrow.circlepath"
        case .missed: return "xmark.circle.fill"
        case .excused: return "minus.circle.fill"
        case nil: return "circle"
        }
    }
}
