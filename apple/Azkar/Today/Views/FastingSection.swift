import AzkarKit
import SwiftUI

/// Fasting on Today. In Ramadan: the day of Ramadan, when suhoor ends (Fajr) and iftar is
/// (Maghrib), a countdown to the next of them, and today's fast. Outside Ramadan, only on a day
/// recommended for a voluntary fast (or one with a fast logged): why, and "I'm fasting today".
/// Never on the two Eids or the days of Tashriq.
struct FastingSection: View {
    @Environment(AppEnvironment.self) private var app
    let context: TodayContext
    let clock: TodayClock

    var body: some View {
        let offset = app.settings.settings.app.hijriOffset
        let info = FastingCalendar.info(for: context.today, offset: offset)
        let record = app.records.records.fasts[context.today]
        if let ramadanDay = info.ramadanDay {
            RamadanCard(context: context, clock: clock, ramadanDay: ramadanDay, record: record,
                        tomorrowIsRamadan: HijriCalendar.isRamadan(context.today.adding(days: 1), offset: offset))
        } else if info.forbidden == nil, info.isRecommended || record != nil {
            RecommendedFastCard(context: context, info: info, record: record)
        }
    }
}

/// Writes today's fast: `nil` clears it.
private func setFast(_ app: AppEnvironment, _ value: (FastKind, FastStatus)?, on day: DayKey) {
    Task {
        do {
            if let value {
                try await app.records.setFast(value.0, value.1, on: day)
            } else {
                try await app.records.clearFast(on: day)
            }
        } catch {
            print("Today: saving the fast on \(day) failed: \(error)")
        }
    }
}

private struct RamadanCard: View {
    @Environment(AppEnvironment.self) private var app
    @Environment(\.todayFormat) private var format
    let context: TodayContext
    let clock: TodayClock
    let ramadanDay: Int
    let record: FastRecord?
    let tomorrowIsRamadan: Bool

    private struct Moment {
        let isIftar: Bool
        let at: Date
        let tomorrow: Bool
    }

    var body: some View {
        let fasting = record?.kind == .ramadan && record?.status == .fasted
        let excused = record?.kind == .ramadan && record?.status == .excused
        let suhoor = context.todayTimes?[.fajr]
        let iftar = context.todayTimes?[.maghrib]
        Section {
            VStack(alignment: .leading, spacing: 12) {
                Label {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(L("Ramadan"))
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(.indigo)
                        Text(L("Day \(ramadanDay) of Ramadan"))
                            .font(.title3.bold())
                    }
                } icon: {
                    Image(systemName: "moon.haze.fill").foregroundStyle(.indigo).font(.title2)
                }
                .accessibilityElement(children: .combine)

                if let pages = RamadanGoal.pagesPerDay(goal: app.settings.settings.app.ramadanKhatmahGoal, today: context.today,
                                                       offset: app.settings.settings.app.hijriOffset, quran: app.records.records.quran) {
                    Text(pages == 0 ? SeasonL("Goal reached") : SeasonL("To reach your goal: \(pages) pages a day"))
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                if context.todayTimes == nil {
                    Text(L("The times of suhoor and iftar appear once a location is set."))
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                } else {
                    HStack(alignment: .top, spacing: 12) {
                        if let suhoor { time(L("Suhoor ends"), slot: .fajr, at: suhoor) }
                        if let iftar { time(L("Iftar"), slot: .maghrib, at: iftar) }
                    }
                    if let next = nextMoment(suhoor: suhoor, iftar: iftar) {
                        countdown(next)
                    } else if !tomorrowIsRamadan, iftar.map({ context.now >= $0 }) == true {
                        Text(L("Tomorrow is Eid al-Fitr."))
                            .font(.subheadline.weight(.medium))
                    }
                }
            }
            .padding(.vertical, 4)

            Toggle(isOn: Binding(get: { fasting }, set: { setFast(app, $0 ? (.ramadan, .fasted) : nil, on: context.today) })) {
                Text(L("I’m fasting today"))
            }
            Toggle(isOn: Binding(get: { excused }, set: { setFast(app, $0 ? (.ramadan, .excused) : nil, on: context.today) })) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(L("Excused today"))
                    Text(L("Travel, illness or menstruation: the day is made up later"))
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .sensoryFeedback(.success, trigger: fasting) { _, new in new }
    }

    private func time(_ title: LocalizedStringResource, slot: TimeSlot, at: Date) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title).font(.subheadline).foregroundStyle(.secondary)
            Text(verbatim: format.time(at)).font(.title2.weight(.semibold)).monospacedDigit()
            Text(slot.title).font(.caption).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }

    private func nextMoment(suhoor: Date?, iftar: Date?) -> Moment? {
        var moments: [Moment] = []
        if let suhoor { moments.append(Moment(isIftar: false, at: suhoor, tomorrow: false)) }
        if let iftar { moments.append(Moment(isIftar: true, at: iftar, tomorrow: false)) }
        if tomorrowIsRamadan, let next = context.tomorrowTimes?[.fajr] {
            moments.append(Moment(isIftar: false, at: next, tomorrow: true))
        }
        return moments.first { $0.at > context.now }
    }

    private func countdown(_ moment: Moment) -> some View {
        let end = clock.realDate(for: moment.at)
        let label: LocalizedStringResource = moment.isIftar ? L("until iftar") : moment.tomorrow ? L("until suhoor ends tomorrow") : L("until suhoor ends")
        return HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text(timerInterval: min(clock.realNow, end)...end, countsDown: true, showsHours: true)
                .font(.system(.title, design: .rounded).weight(.medium))
                .monospacedDigit()
                .environment(\.layoutDirection, .leftToRight)
            Text(label).font(.subheadline).foregroundStyle(.secondary)
        }
        .accessibilityElement(children: .combine)
    }
}

private struct RecommendedFastCard: View {
    @Environment(AppEnvironment.self) private var app
    @Environment(\.todayFormat) private var format
    let context: TodayContext
    let info: FastingDayInfo
    let record: FastRecord?

    var body: some View {
        let fasting = record?.status == .fasted
        let kind: FastKind = record?.kind == .qada ? .qada : .voluntary
        Section {
            VStack(alignment: .leading, spacing: 6) {
                Label {
                    Text(info.isRecommended ? L("A sunnah fast today") : L("Today’s fast"))
                        .font(.headline)
                } icon: {
                    Image(systemName: "sun.horizon.fill").foregroundStyle(.orange)
                }
                ForEach(info.reasons, id: \.self) { reason in
                    Text(reason.title(hijri: info.hijri, format: format))
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }
            .accessibilityElement(children: .combine)
            .padding(.vertical, 2)

            Toggle(isOn: Binding(get: { fasting }, set: { setFast(app, $0 ? (kind, .fasted) : nil, on: context.today) })) {
                Text(L("I’m fasting today"))
            }
            .sensoryFeedback(.success, trigger: fasting) { _, new in new }
        }
    }
}
