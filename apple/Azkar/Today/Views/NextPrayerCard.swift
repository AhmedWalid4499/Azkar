import AzkarKit
import SwiftUI

/// The next prayer: its name and time, a live countdown, and what time of prayer it is now.
/// Only the countdown moves; the rest is redrawn when the clock moves (see `TodayClock`).
struct NextPrayerCard: View {
    @Environment(AppEnvironment.self) private var app
    @Environment(\.todayFormat) private var format
    @Environment(\.dynamicTypeSize) private var typeSize
    let schedule: PrayerSchedule
    let context: TodayContext
    let clock: TodayClock

    var body: some View {
        Section {
            if let next = schedule.next(after: context.now) {
                content(next)
            } else {
                Label {
                    Text(L("Today’s prayer times can’t be calculated at this location."))
                } icon: {
                    Image(systemName: "exclamationmark.triangle")
                }
                .foregroundStyle(.secondary)
            }
        }
    }

    private func content(_ next: UpcomingPrayer) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(L("Next prayer"))
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.tint)
                .textCase(nil)

            let large = typeSize.isAccessibilitySize
            let line = large
                ? AnyLayout(VStackLayout(alignment: .leading, spacing: 4))
                : AnyLayout(HStackLayout(alignment: .firstTextBaseline))
            line {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    if !large {
                        Image(systemName: TimeSlot(next.prayer).symbol)
                            .font(.title)
                            .foregroundStyle(.tint)
                            .accessibilityHidden(true)
                    }
                    Text(next.prayer.title)
                        .font(.largeTitle.bold())
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)
                }
                if !large { Spacer(minLength: 8) }
                VStack(alignment: large ? .leading : .trailing, spacing: 2) {
                    Text(verbatim: format.time(next.at))
                        .font(.title2.weight(.semibold))
                        .monospacedDigit()
                    if next.day != context.today {
                        Text(L("Tomorrow"))
                            .font(.caption.weight(.medium))
                            .foregroundStyle(.secondary)
                    }
                }
            }

            countdown(to: next.at)

            if let period = periodText {
                period
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(.vertical, 6)
        .accessibilityElement(children: .combine)
    }

    private func countdown(to moment: Date) -> some View {
        let end = clock.realDate(for: moment)
        let start = min(clock.realNow, end)
        let layout = typeSize.isAccessibilitySize
            ? AnyLayout(VStackLayout(alignment: .leading, spacing: 2))
            : AnyLayout(HStackLayout(alignment: .firstTextBaseline, spacing: 8))
        return layout {
            Text(timerInterval: start...end, countsDown: true, showsHours: true)
                .font(.system(.largeTitle, design: .rounded).weight(.medium))
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.5)
                .contentTransition(.numericText(countsDown: true))
                .environment(\.layoutDirection, .leftToRight)
            Text(L("remaining"))
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
    }

    /// "It is Asr time now, until 5:42 PM", or the forenoon between sunrise and Dhuhr.
    private var periodText: Text? {
        let now = context.now
        if let current = schedule.current(at: now) {
            let index = schedule.days.firstIndex { $0.day == current.day }
            let day = index.map { schedule.days[$0] }
            let nextDay = index.flatMap { $0 + 1 < schedule.days.count ? schedule.days[$0 + 1] : nil }
            let ishaEnds = app.settings.settings.reminders.ishaDeadline
            if let deadline = day?.deadline(for: current.prayer, nextDay: nextDay, ishaEnds: ishaEnds), deadline.endsAt > now {
                let until = format.time(deadline.endsAt)
                return Text(L("It is \(format.string(current.prayer.title)) time now, until \(until)"))
            }
            return Text(L("It is \(format.string(current.prayer.title)) time now"))
        }
        let today = schedule.todayTimes
        if let sunrise = today[.sunrise], let dhuhr = today[.dhuhr], now >= sunrise, now < dhuhr {
            return Text(L("Between sunrise and Dhuhr: the time of Duha"))
        }
        return nil
    }
}
