import AzkarKit
import SwiftUI

/// Today's six times, the current and next prayer marked in words, each obligatory prayer with
/// its log control. Before dawn, last night's Isha comes first while it is unlogged.
struct PrayersSection: View {
    @Environment(\.todayFormat) private var format
    let context: TodayContext

    var body: some View {
        if let schedule = context.schedule {
            let times = schedule.todayTimes
            let current = schedule.current(at: context.now)
            let next = schedule.next(after: context.now)
            Section {
                LastNightIshaRow(context: context)
                ForEach(TimeSlot.allCases) { slot in
                    PrayerTimeRow(
                        slot: slot,
                        time: times[slot],
                        day: context.today,
                        badge: badge(for: slot, current: current, next: next)
                    )                }
            } header: {
                Text(L("Today’s prayers"))
            } footer: {
                if times.hasMissingTimes {
                    Text(L("Some times can’t be calculated here today because the sun doesn’t rise, doesn’t set, or stays too close to the horizon. Settings can borrow the times of the nearest latitude."))
                }
            }
        }
    }

    private func badge(for slot: TimeSlot, current: UpcomingPrayer?, next: UpcomingPrayer?) -> PrayerTimeRow.Badge? {
        guard let prayer = slot.prayer else { return nil }
        if let current, current.prayer == prayer, current.day == context.today { return .now }
        if let next, next.prayer == prayer, next.day == context.today { return .next }
        return nil
    }
}

/// One line of the timetable.
struct PrayerTimeRow: View {
    enum Badge {
        case now, next

        var title: LocalizedStringResource {
            switch self {
            case .now: L("Now")
            case .next: L("Next")
            }
        }
    }

    @Environment(\.todayFormat) private var format
    @Environment(\.dynamicTypeSize) private var typeSize
    let slot: TimeSlot
    let time: Date?
    let day: DayKey
    let badge: Badge?

    var body: some View {
        HStack(spacing: 12) {
            info
            if let prayer = slot.prayer {
                PrayerLogControl(prayer: prayer, day: day)
            } else {
                // Sunrise is not prayed: keep the times lined up with the others.
                Color.clear.frame(width: 44, height: 1).accessibilityHidden(true)
            }
        }
        .listRowBackground(badge == .now ? Color.accentColor.opacity(0.12) : nil)
    }

    private var info: some View {
        let layout = typeSize.isAccessibilitySize
            ? AnyLayout(VStackLayout(alignment: .leading, spacing: 4))
            : AnyLayout(HStackLayout(spacing: 8))
        return layout {
            HStack(spacing: 8) {
                Image(systemName: slot.symbol)
                    .foregroundStyle(slot.prayer == nil ? Color.secondary : Color.accentColor)
                    .frame(width: 26)
                    .accessibilityHidden(true)
                Text(slot.title)
                    .font(badge == nil ? .body : .body.weight(.semibold))
                    .foregroundStyle(slot.prayer == nil ? .secondary : .primary)
                if let badge {
                    Text(badge.title)
                        .font(.caption.weight(.bold))
                        .textCase(.uppercase)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 2)
                        .background(badge == .now ? Color.accentColor : Color.accentColor.opacity(0.15), in: .capsule)
                        .foregroundStyle(badge == .now ? Color.white : Color.accentColor)
                }
            }
            if !typeSize.isAccessibilitySize { Spacer(minLength: 4) }
            timeText
        }
        .accessibilityElement(children: .combine)
    }

    @ViewBuilder
    private var timeText: some View {
        if let time {
            Text(verbatim: format.time(time))
                .font(badge == nil ? .body : .body.weight(.semibold))
                .monospacedDigit()
                .foregroundStyle(slot.prayer == nil ? .secondary : .primary)
        } else {
            Text(verbatim: "—")
                .foregroundStyle(.secondary)
                .accessibilityLabel(Text(L("Not available")))
        }
    }
}

/// After midnight the timetable already shows the new day. Until Fajr this row offers the Isha
/// of the night that is ending while it is still unlogged, so logging it files it under the
/// day it belongs to. Logged from here, it stays for the rest of the visit, to be corrected.
struct LastNightIshaRow: View {
    @Environment(AppEnvironment.self) private var app
    @Environment(\.todayFormat) private var format
    let context: TodayContext
    @State private var keptFor: DayKey?

    var body: some View {
        let yesterday = context.yesterday
        let unlogged = app.records.records.prayers[yesterday]?.prayers[.isha] == nil
        if context.beforeDawn, unlogged || keptFor == yesterday {
            HStack(spacing: 12) {
                HStack(spacing: 8) {
                    Image(systemName: "moon.stars.fill")
                        .foregroundStyle(.indigo)
                        .frame(width: 26)
                        .accessibilityHidden(true)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(L("Last night’s Isha"))
                            .font(.body.weight(.semibold))
                        Text(L("Counts for \(format.weekdayAndDate(yesterday))"))
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                    Spacer(minLength: 4)
                }
                .accessibilityElement(children: .combine)
                PrayerLogControl(prayer: .isha, day: yesterday) { keptFor = yesterday }
            }
            .listRowBackground(Color.indigo.opacity(0.1))
        }
    }
}
