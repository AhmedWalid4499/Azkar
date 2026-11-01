import AzkarCore
import Foundation
import Testing
@testable import AzkarContent

@Suite struct SeasonRemindersTests {
    // 1 Ramadan 1448 is 8 February 2027 in the Umm al-Qura calendar.
    private let firstOfRamadan = DayKey(year: 2027, month: 2, day: 8)!

    private func choices(_ change: (inout SeasonReminderChoices) -> Void) -> SeasonReminderChoices {
        var choices = SeasonReminderChoices()
        change(&choices)
        return choices
    }

    private func kinds(on day: DayKey, _ choices: SeasonReminderChoices) -> [SeasonReminder.Kind] {
        SeasonReminders.plan(for: day, choices: choices).map(\.kind)
    }

    /// A day of 1448's Hijri month, with no white day or weekday in the way unless asked.
    private func day(month: Int, _ number: Int) -> DayKey {
        HijriCalendar.civilDays(ofYear: 1448, month: month)[number - 1]
    }

    @Test func nothingWithEverythingOff() {
        for offset in 0..<400 {
            #expect(SeasonReminders.plan(for: firstOfRamadan.adding(days: offset - 200), choices: SeasonReminderChoices()).isEmpty)
        }
    }

    @Test func theEveningBeforeAMondayOrThursday() throws {
        let sunday = DayKey(year: 2026, month: 11, day: 1)!
        let wanted = choices { $0.mondayThursday = true }
        #expect(kinds(on: sunday, wanted) == [.fast(.monday)])
        #expect(kinds(on: sunday.adding(days: 1), wanted) == [])
        #expect(kinds(on: sunday.adding(days: 3), wanted) == [.fast(.thursday)])
        let reminder = try #require(SeasonReminders.plan(for: sunday, choices: wanted).first)
        #expect(reminder.anchor == .isha)
    }

    @Test func theWhiteDaysEachHaveAnEvening() {
        let wanted = choices { $0.whiteDays = true }
        let month = HijriDate.shawwal
        #expect(kinds(on: day(month: month, 11), wanted) == [])
        for number in 12...14 { #expect(kinds(on: day(month: month, number), wanted) == [.fast(.whiteDays)]) }
        #expect(kinds(on: day(month: month, 15), wanted) == [])
    }

    @Test func aDayIsToldOnceByItsMostParticularReason() {
        // Find an Arafah-eve style clash: a white day that is also a Monday or Thursday.
        let wanted = choices { $0.whiteDays = true; $0.mondayThursday = true }
        for month in [1, 2, 3, 4, 5, 6, 7, 8, 10, 11] {
            for number in 12...14 {
                let found = kinds(on: day(month: month, number), wanted)
                #expect(found == [.fast(.whiteDays)])
            }
        }
    }

    @Test func arafahAndAshura() {
        let wanted = choices { $0.occasions = true }
        #expect(kinds(on: day(month: HijriDate.dhuAlHijjah, 8), wanted) == [.fast(.arafah)])
        let muharram = HijriCalendar.civilDays(ofYear: 1449, month: HijriDate.muharram)
        #expect(kinds(on: muharram[7], wanted) == [.fast(.tasua)])
        #expect(kinds(on: muharram[8], wanted) == [.fast(.ashura)])
    }

    @Test func noFastReminderForRamadanTheEidOrShawwal() {
        let wanted = choices { $0.mondayThursday = true; $0.whiteDays = true; $0.occasions = true }
        for offset in -1..<29 { #expect(kinds(on: firstOfRamadan.adding(days: offset), wanted) == []) }
        // The eve of the Eid, and of the days of Tashriq.
        #expect(kinds(on: day(month: HijriDate.shawwal, 1).adding(days: -1), wanted) == [])
        #expect(kinds(on: day(month: HijriDate.dhuAlHijjah, 10), wanted).isEmpty)
        // A Shawwal day that is nothing else stays silent, unlike its Monday.
        let onlyShawwal = choices { $0.occasions = true }
        for number in 2...29 { #expect(kinds(on: day(month: HijriDate.shawwal, number), onlyShawwal) == []) }
    }

    @Test func suhoorAndIftarComeBeforeTheirPrayersInRamadanOnly() {
        let wanted = choices { $0.suhoor = true; $0.iftar = true; $0.suhoorLeadMinutes = 60 }
        let plan = SeasonReminders.plan(for: firstOfRamadan, choices: wanted)
        #expect(plan == [
            SeasonReminder(kind: .suhoor, anchor: .fajr, offsetMinutes: -60),
            SeasonReminder(kind: .iftar, anchor: .maghrib, offsetMinutes: -15),
        ])
        #expect(kinds(on: firstOfRamadan.adding(days: -1), wanted) == [])
        #expect(kinds(on: day(month: HijriDate.shawwal, 1), wanted) == [])
    }

    @Test func theOddNightsOfTheLastTen() {
        let wanted = choices { $0.oddNights = true }
        let nights = RamadanCalendar.nights(hijriYear: 1448)
        let reminded = nights.filter { !kinds(on: $0.evening, wanted).isEmpty }.map(\.number)
        #expect(reminded == [21, 23, 25, 27, 29])
    }

    @Test func kahfBeginsOnThePageTheRemindersOpen() {
        #expect(QuranMushaf.bundled.suras[17].page == SeasonReminders.kahfPage)
        #expect(QuranMushaf.bundled.suras[17].number == 18)
    }

    @Test func surahAlKahfOnFridaysOnly() {
        let friday = DayKey(year: 2026, month: 11, day: 6)!
        let wanted = choices { $0.kahf = true }
        #expect(SeasonReminders.plan(for: friday, choices: wanted) == [SeasonReminder(kind: .kahf, anchor: .sunrise, offsetMinutes: 60)])
        for offset in 1...6 { #expect(kinds(on: friday.adding(days: offset), wanted) == []) }
    }

    @Test func witrAndDuhaComeEveryDayUntilTicked() {
        let day = DayKey(year: 2026, month: 11, day: 3)!
        let wanted = choices { $0.witr = true; $0.duha = true; $0.witrDelayMinutes = 60 }
        #expect(SeasonReminders.plan(for: day, choices: wanted) == [
            SeasonReminder(kind: .duha, anchor: .sunrise, offsetMinutes: 45),
            SeasonReminder(kind: .witr, anchor: .isha, offsetMinutes: 60),
        ])
        let ticked = SeasonReminders.plan(for: day, choices: wanted) { sunnah, on in sunnah == .witr && on == day }
        #expect(ticked.map(\.kind) == [.duha])
    }
}
