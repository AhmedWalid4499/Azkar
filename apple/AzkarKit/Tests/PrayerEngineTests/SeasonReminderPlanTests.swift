import AzkarCore
import Foundation
import Testing
@testable import PrayerEngine

@Suite struct SeasonReminderPlanTests {
    private let day = DayKey(year: 2027, month: 2, day: 8)!
    private let fajr = Date(timeIntervalSince1970: 1_800_000_000)
    private var maghrib: Date { fajr.addingTimeInterval(12 * 3600) }

    private var prayers: PrayerDay {
        PrayerDay(day: day, timeZone: .gmt, times: [.fajr: fajr, .maghrib: maghrib])
    }

    private func entries(_ reminders: [SeasonReminder]) -> [ReminderEntry] {
        let choices = ReminderChoices(prayers: false, morning: false, evening: false, morningAt: .fajr, season: { _ in reminders })
        return ReminderPlan.entries(days: [prayers], choices: choices)
    }

    @Test func aReminderComesItsOffsetFromItsPrayer() {
        let found = entries([
            SeasonReminder(kind: .suhoor, anchor: .fajr, offsetMinutes: -45),
            SeasonReminder(kind: .iftar, anchor: .maghrib, offsetMinutes: -15),
        ])
        #expect(found.map(\.at) == [fajr.addingTimeInterval(-45 * 60), maghrib.addingTimeInterval(-15 * 60)])
    }

    @Test func aTimeThatDoesNotExistThatDayIsLeftOut() {
        #expect(entries([SeasonReminder(kind: .fast(.monday), anchor: .isha)]).isEmpty)
    }

    @Test func idsStayClearOfThePrayersAndAzkar() {
        let found = entries([
            SeasonReminder(kind: .fast(.monday), anchor: .fajr),
            SeasonReminder(kind: .suhoor, anchor: .fajr),
            SeasonReminder(kind: .iftar, anchor: .fajr),
        ])
        #expect(found.map(\.id) == [202_702_087, 202_702_088, 202_702_089])
    }

    @Test func noChoicesMeansNoSeasonReminders() {
        let choices = ReminderChoices(prayers: true, morning: false, evening: false, morningAt: .fajr)
        #expect(ReminderPlan.entries(days: [prayers], choices: choices).allSatisfy {
            if case .prayer = $0.kind { true } else { false }
        })
    }

    @Test func everyKindOfSeasonReminderHasAnIDOfItsOwn() {
        let kinds: [SeasonReminder.Kind] = [.fast(.monday), .suhoor, .iftar, .kahf, .witr, .duha, .zakat, .zakatFitr]
        let ids = kinds.map { ReminderPlan.seasonReminderID(day: day, kind: $0) }
        #expect(Set(ids).count == kinds.count)
        let prayers = Prayer.allCases.map { ReminderPlan.unloggedReminderID(day: day, prayer: $0) }
        #expect(Set(ids).isDisjoint(with: prayers))
    }
}

@Suite struct ReminderCapTests {
    @Test func whenThereAreTooManyThePrayersAreKeptAndDuhaAndWitrGiveWay() throws {
        let zone = TimeZone(identifier: "Asia/Riyadh")!
        let place = try #require(PrayerPlace(latitude: 24.7136, longitude: 46.6753, timeZoneIdentifier: "Asia/Riyadh", countryCode: "SA"))
        let now = Date(timeIntervalSince1970: 1_793_500_000)
        // Duha, Witr and a fast reminder every day: 3 a day on top of the 12 the prayers and azkar take.
        let season: [SeasonReminder] = [
            SeasonReminder(kind: .duha, anchor: .sunrise, offsetMinutes: 45),
            SeasonReminder(kind: .witr, anchor: .isha, offsetMinutes: 120),
            SeasonReminder(kind: .fast(.monday), anchor: .isha),
        ]
        let choices = ReminderChoices(prayers: true, morning: true, evening: true, morningAt: .fajr,
                                      unlogged: UnloggedChoices(leadMinutes: 15, ishaEnds: .middle, logged: [:]),
                                      season: { _ in season })
        let entries = ReminderPlan.upcoming(dayFor: { PrayerCalculator.day($0, at: place, config: CalculationConfig()) },
                                            timeZone: zone, choices: choices, now: now)
        #expect(entries.count == ReminderPlan.reminderLimit)
        // The first fifty prayer, "not logged yet" and azkar reminders are all there, as on the website.
        let all = ReminderPlan.entries(days: (0..<10).map { PrayerCalculator.day(DayKey(now, in: zone).adding(days: $0 - 1), at: place, config: CalculationConfig()) }, choices: choices)
            .filter { $0.at > now && $0.at <= now.addingTimeInterval(7 * 86_400) }
        let core = all.filter { if case .season = $0.kind { false } else { true } }
        #expect(core.count > ReminderPlan.reminderLimit)
        #expect(entries == Array(core.prefix(ReminderPlan.reminderLimit)))
        // Still in time order.
        #expect(entries.map(\.at) == entries.map(\.at).sorted())
    }
}
