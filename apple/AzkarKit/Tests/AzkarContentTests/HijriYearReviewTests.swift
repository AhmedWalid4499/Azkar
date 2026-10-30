import AzkarCore
import Foundation
import Testing
@testable import AzkarContent

@Suite struct HijriYearReviewTests {
    // After Ramadan 1448, which begins on 8 February 2027 in the Umm al-Qura calendar.
    private let today = DayKey(year: 2027, month: 3, day: 20)!
    private var muharram: [DayKey] { HijriCalendar.civilDays(ofYear: 1448, month: 1) }
    private var ramadan: [DayKey] { HijriCalendar.civilDays(ofYear: 1448, month: HijriDate.ramadan) }
    private let at = Date(timeIntervalSince1970: 0)

    private func day(_ status: PrayerStatus, count: Int = 5) -> DayPrayerRecord {
        DayPrayerRecord(prayers: Dictionary(uniqueKeysWithValues: Prayer.allCases.prefix(count).map { ($0, PrayerEntry(status: status, loggedAt: at)) }))
    }

    private func review(_ history: TrackerHistory, today: DayKey? = nil) -> HijriYearReview {
        HijriYearReview(hijriYear: 1448, offset: 0, today: today ?? self.today, history: history)
    }

    @Test func emptyHistoryHasNothing() {
        let result = review(TrackerHistory())
        #expect(!result.hasAnyRecord)
        #expect(!result.isFinished)
        #expect(result.months.count == 12)
        #expect(result.prayed == 0)
    }

    @Test func prayersCountByStatusAndByMonth() {
        let history = TrackerHistory(prayers: [muharram[0]: day(.ontime), muharram[1]: day(.jamaah, count: 2), ramadan[0]: day(.missed)])
        let result = review(history)
        #expect(result.prayers.ontime == 5)
        #expect(result.prayers.jamaah == 2)
        #expect(result.prayers.missed == 5)
        #expect(result.prayed == 7)
        #expect(result.months[0].prayed == 7)
        #expect(result.months[8].prayed == 0)
        #expect(result.activeDays == 3)
    }

    @Test func aStreakBreaksOnAnIncompleteDayAndCarriesOverAnExemptOne() {
        let history = TrackerHistory(prayers: [
            muharram[0]: day(.ontime), muharram[1]: day(.ontime), muharram[2]: day(.excused), muharram[3]: day(.ontime),
            muharram[4]: day(.ontime, count: 3),
            muharram[5]: day(.ontime),
        ])
        let result = review(history)
        #expect(result.bestStreak == 3)
        #expect(result.completeDays == 4)
    }

    @Test func todayUnderWayDoesNotBreakAStreak() {
        let history = TrackerHistory(prayers: [muharram[0]: day(.ontime), muharram[1]: day(.ontime, count: 2)])
        #expect(review(history, today: muharram[1]).bestStreak == 1)
    }

    @Test func aFutureDayCountsForNothing() {
        let history = TrackerHistory(prayers: [ramadan[0]: day(.ontime)], fasts: [ramadan[0]: FastRecord(kind: .ramadan, status: .fasted, loggedAt: nil)])
        let result = review(history, today: ramadan[0].adding(days: -1))
        #expect(result.prayed == 0)
        #expect(result.fastsKept == 0)
        #expect(!result.hasAnyRecord)
    }

    @Test func recordsOutsideTheYearAreLeftOut() {
        let before = muharram[0].adding(days: -1)
        let history = TrackerHistory(prayers: [before: day(.ontime)])
        #expect(review(history).prayed == 0)
    }

    @Test func sessionsOnlyCountWhenFinishedButAllRecitationsCount() {
        let history = TrackerHistory(sessions: [
            muharram[0]: [.morning: SessionRecord(completed: true, recitations: 30), .evening: SessionRecord(completed: false, recitations: 12)],
            muharram[1]: [.afterPrayer(.asr): SessionRecord(completed: true, recitations: 5)],
        ])
        let result = review(history)
        #expect(result.sessionsCompleted == 2)
        #expect(result.sessions[.morning] == 1)
        #expect(result.sessions[.evening] == nil)
        #expect(result.sessions[.afterPrayer(.asr)] == 1)
        #expect(result.recitations == 47)
        #expect(result.months[0].sessions == 2)
    }

    @Test func quranCountsPagesDaysAndKhatmahs() {
        let history = TrackerHistory(quran: [
            QuranEntry(day: muharram[0], at: at, kind: .read, fromPage: 0, toPage: 20),
            QuranEntry(day: ramadan[0], at: at.addingTimeInterval(1), kind: .read, fromPage: 20, toPage: 604),
            QuranEntry(day: ramadan[1], at: at.addingTimeInterval(2), kind: .khatmah, fromPage: 0, toPage: 0),
        ])
        let result = review(history)
        #expect(result.pages == 604)
        #expect(result.quranDays == 2)
        #expect(result.khatmahs == 2)
        #expect(result.months[8].pages == 584)
    }

    @Test func fastsAndSeasonsAgreeWithTheRamadanSummary() {
        let eve = ramadan[0].adding(days: -1)
        let history = TrackerHistory(
            fasts: [ramadan[0]: FastRecord(kind: .ramadan, status: .fasted, loggedAt: nil), ramadan[1]: FastRecord(kind: .ramadan, status: .excused, loggedAt: nil),
                    muharram[9]: FastRecord(kind: .voluntary, status: .fasted, loggedAt: nil)],
            seasons: [eve: [.tarawih: SeasonRecord(deed: .tarawih, day: eve, at: at, place: .masjid)]]
        )
        let result = review(history)
        let summary = RamadanSummary(hijriYear: 1448, offset: 0, history: history)
        #expect(result.fasts[.ramadan] == summary.fasted)
        #expect(result.fasts[.voluntary] == 1)
        #expect(result.tarawih == summary.tarawih)
        #expect(result.activeDays == 4)
    }

    @Test func yearsAreNewestFirstAndAlwaysHoldTheCurrentOne() {
        let lastYear = muharram[0].adding(days: -30)
        let history = TrackerHistory(prayers: [lastYear: day(.ontime), today.adding(days: 400): day(.ontime)])
        #expect(history.reviewYears(current: 1448, today: today, offset: 0) == [1448, 1447])
        #expect(TrackerHistory().reviewYears(current: 1448, today: today, offset: 0) == [1448])
    }
}
