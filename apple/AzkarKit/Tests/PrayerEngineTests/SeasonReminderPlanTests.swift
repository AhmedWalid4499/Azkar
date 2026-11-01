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
        let kinds: [SeasonReminder.Kind] = [.fast(.monday), .suhoor, .iftar, .kahf, .witr, .duha]
        let ids = kinds.map { ReminderPlan.seasonReminderID(day: day, kind: $0) }
        #expect(Set(ids).count == kinds.count)
        let prayers = Prayer.allCases.map { ReminderPlan.unloggedReminderID(day: day, prayer: $0) }
        #expect(Set(ids).isDisjoint(with: prayers))
    }
}
