import AzkarCore
import Foundation
import Testing
@testable import AzkarContent

@Suite struct QuranGlanceTests {
    private let day = DayKey(year: 2026, month: 10, day: 30)!

    private func read(_ from: Int, _ to: Int, on day: DayKey, at seconds: Double) -> QuranEntry {
        QuranEntry(day: day, at: Date(timeIntervalSince1970: seconds), kind: .read, fromPage: from, toPage: to)
    }

    @Test func indexAgreesWithTheMushafOnEveryPage() {
        let mushaf = QuranMushaf.bundled
        let index = QuranPageIndex.bundled
        for page in QuranMushaf.pages {
            #expect(index.juz(ofPage: page) == mushaf.juz(ofPage: page).number, "juz of page \(page)")
            #expect(index.suraName(ofPage: page) == mushaf.sura(ofPage: page).name, "surah of page \(page)")
            #expect(index.suraTransliteration(ofPage: page) == mushaf.sura(ofPage: page).transliteration)
        }
    }

    @Test func nothingReadYetOpensOnTheFirstPage() {
        let glance = QuranGlance(entries: [], today: day)
        #expect(glance.nextPage == 1)
        #expect(glance.juz == 1)
        #expect(glance.suraTransliteration == "Al-Faatiha")
        #expect(glance.fraction == 0)
        #expect(!glance.hasStarted)
    }

    @Test func goesOnFromTheNextPageAndCountsOnlyToday() {
        let entries = [read(0, 40, on: day.adding(days: -1), at: 1), read(40, 50, on: day, at: 2)]
        let glance = QuranGlance(entries: entries, today: day)
        #expect(glance.position == 50)
        #expect(glance.nextPage == 51)
        #expect(glance.pagesToday == 10)
        #expect(glance.juz == 3)
        #expect(glance.hasStarted)
    }

    @Test func finishingStartsAgainAndCountsTheKhatmah() {
        let glance = QuranGlance(entries: [read(0, 604, on: day, at: 1)], today: day)
        #expect(glance.position == 0)
        #expect(glance.nextPage == 1)
        #expect(glance.khatmahs == 1)
        #expect(glance.pagesToday == 604)
    }
}

@Suite struct RamadanGlanceTests {
    // 1 Ramadan 1448 is 8 February 2027 in the Umm al-Qura calendar.
    private let first = DayKey(year: 2027, month: 2, day: 8)!
    private var tarawih: SeasonRecord {
        SeasonRecord(deed: .tarawih, day: first.adding(days: 4), at: Date(timeIntervalSince1970: 0), place: .masjid)
    }

    private func glance(_ today: DayKey, beforeDawn: Bool = false, goal: Int = 0, tarawih: SeasonRecord? = nil) -> RamadanGlance? {
        RamadanGlance(today: today, beforeDawn: beforeDawn, offset: 0, goal: goal, quran: [], tarawih: tarawih)
    }

    @Test func noneOutsideRamadan() {
        #expect(glance(first.adding(days: -10)) == nil)
    }

    @Test func theEveBeforeOpensOnTheFirstNight() {
        let eve = glance(first.adding(days: -1))
        #expect(eve?.day == nil)
        #expect(eve?.night?.number == 1)
    }

    @Test func aDayLeadsToTheNightAfterIt() {
        let day = glance(first.adding(days: 4), tarawih: tarawih)
        #expect(day?.day == 5)
        #expect(day?.night?.number == 6)
        #expect(day?.tarawih == tarawih)
    }

    @Test func beforeDawnIsStillLastNight() {
        let dawn = glance(first.adding(days: 4), beforeDawn: true)
        #expect(dawn?.day == 5)
        #expect(dawn?.night?.number == 5)
        #expect(RamadanGlance.evening(today: first.adding(days: 4), beforeDawn: true) == first.adding(days: 3))
    }

    @Test func theLastEveningHasNoTarawih() {
        let days = HijriCalendar.civilDays(ofYear: 1448, month: HijriDate.ramadan, offset: 0)
        let last = glance(days.last!, tarawih: tarawih)
        #expect(last?.day == days.count)
        #expect(last?.night == nil)
        #expect(last?.tarawih == nil)
    }

    @Test func theEidHasNone() {
        let days = HijriCalendar.civilDays(ofYear: 1448, month: HijriDate.ramadan, offset: 0)
        #expect(glance(days.last!.adding(days: 1), beforeDawn: true) == nil)
    }

    @Test func aGoalGivesThePagesADay() {
        #expect(glance(first, goal: 1)?.pagesPerDay != nil)
        #expect(glance(first)?.pagesPerDay == nil)
    }
}
