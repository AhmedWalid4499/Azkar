import Foundation
import Testing
@testable import AzkarCore

/// Everything `QuranProgress` works out from the log.
@Suite struct QuranProgressTests {
    let first = DayKey("2026-09-01")!
    let second = DayKey("2026-09-02")!
    let third = DayKey("2026-09-03")!

    func at(_ minute: Int) -> Date { Date(timeIntervalSince1970: 1_788_000_000 + Double(minute) * 60) }

    func read(_ from: Int, _ to: Int, on day: DayKey? = nil, minute: Int) -> QuranEntry {
        QuranEntry(day: day ?? first, at: at(minute), kind: .read, fromPage: from, toPage: to)
    }

    func khatmah(from: Int = 0, on day: DayKey? = nil, minute: Int) -> QuranEntry {
        QuranEntry(day: day ?? first, at: at(minute), kind: .khatmah, fromPage: from, toPage: 0)
    }

    @Test func anEmptyLogIsTheStart() {
        let progress = QuranProgress(entries: [])
        #expect(progress.position == 0 && progress.khatmahs == 0 && progress.totalPages == 0)
        #expect(progress.pagesByDay.isEmpty && progress.khatmahDates.isEmpty)
        #expect(progress.lastReadAt == nil && progress.currentKhatmahStart == nil)
        #expect(progress.pages(on: first) == 0)
    }

    @Test func theFirstReadCountsFromTheStart() {
        let progress = QuranProgress(entries: [read(0, 7, minute: 0)])
        #expect(progress.position == 7)
        #expect(progress.totalPages == 7)
        #expect(progress.pages(on: first) == 7)
        #expect(progress.lastReadAt == at(0))
        #expect(progress.currentKhatmahStart == first)
    }

    @Test func readsAddUpByDayAndInAll() {
        let progress = QuranProgress(entries: [
            read(0, 10, on: first, minute: 0), read(10, 15, on: first, minute: 1), read(15, 40, on: second, minute: 2),
        ])
        #expect(progress.position == 40)
        #expect(progress.totalPages == 40)
        #expect(progress.pagesByDay == [first: 15, second: 25])
        #expect(progress.pages(on: third) == 0)
        #expect(progress.currentKhatmahStart == first)
    }

    @Test func entriesAreSortedByTimeWhateverOrderTheyComeIn() {
        let entries = [read(10, 20, minute: 1), read(20, 30, minute: 2), read(0, 10, minute: 0)]
        #expect(QuranProgress(entries: entries).position == 30)
        #expect(QuranProgress(entries: entries).lastReadAt == at(2))
    }

    @Test func entriesOfOneInstantKeepTheirOrder() {
        #expect(QuranProgress(entries: [read(600, 604, minute: 0), read(0, 5, minute: 0)]).position == 5)
    }

    @Test func goingBackwardsMovesThePositionAndAddsNoPages() {
        let progress = QuranProgress(entries: [read(0, 100, minute: 0), read(100, 80, minute: 1)])
        #expect(progress.position == 80)
        #expect(progress.totalPages == 100)
        #expect(progress.pages(on: first) == 100)
        // Reading on from there counts again.
        let onwards = QuranProgress(entries: [read(0, 100, minute: 0), read(100, 80, minute: 1), read(80, 90, minute: 2)])
        #expect(onwards.position == 90 && onwards.totalPages == 110)
    }

    @Test func stayingOnThePageAddsNothing() {
        let progress = QuranProgress(entries: [read(0, 12, minute: 0), read(12, 12, minute: 1)])
        #expect(progress.position == 12 && progress.totalPages == 12)
    }

    @Test func reachingTheLastPageFinishesAKhatmahAndStartsAgain() {
        let finished = [read(0, 600, on: first, minute: 0), read(600, 604, on: second, minute: 1)]
        let progress = QuranProgress(entries: finished)
        #expect(progress.position == 0)
        #expect(progress.khatmahs == 1)
        #expect(progress.khatmahDates == [second])
        #expect(progress.totalPages == 604)
        #expect(progress.currentKhatmahStart == nil)

        let again = QuranProgress(entries: finished + [read(0, 5, on: third, minute: 2)])
        #expect(again.position == 5)
        #expect(again.khatmahs == 1)
        #expect(again.totalPages == 609)
        #expect(again.currentKhatmahStart == third)
    }

    @Test func aKhatmahAddedByHandIsCountedAndTheMushafStaysWhereItIs() {
        let progress = QuranProgress(entries: [
            read(0, 300, on: first, minute: 0), khatmah(from: 300, on: second, minute: 1), read(300, 310, on: third, minute: 2),
        ])
        #expect(progress.khatmahs == 1)
        #expect(progress.khatmahDates == [second])
        #expect(progress.position == 310)
        #expect(progress.totalPages == 310)
        #expect(progress.currentKhatmahStart == first)
        #expect(progress.lastReadAt == at(2))
        #expect(QuranEntry(day: first, at: at(0), kind: .khatmah, fromPage: 300, toPage: 0).pages == 0)
    }

    @Test func khatmahsOfBothKindsAreDatedInOrder() {
        let progress = QuranProgress(entries: [
            khatmah(on: first, minute: 0), read(0, 604, on: second, minute: 1), khatmah(on: third, minute: 2),
        ])
        #expect(progress.khatmahs == 3)
        #expect(progress.khatmahDates == [first, second, third])
    }

    @Test func aManualKhatmahAloneIsNoReading() {
        let progress = QuranProgress(entries: [khatmah(minute: 0)])
        #expect(progress.lastReadAt == nil && progress.currentKhatmahStart == nil && progress.position == 0)
    }

    @Test func takingTheLastEntryOutRestoresWhatWasBefore() {
        let log = [read(0, 603, minute: 0), read(603, 604, minute: 1), read(0, 9, minute: 2)]
        #expect(QuranProgress(entries: log).position == 9)
        let undoneOnce = QuranProgress(entries: Array(log.dropLast()))
        #expect(undoneOnce.position == 0 && undoneOnce.khatmahs == 1)
        let undoneTwice = QuranProgress(entries: Array(log.dropLast(2)))
        #expect(undoneTwice.position == 603 && undoneTwice.khatmahs == 0)
        #expect(undoneTwice.currentKhatmahStart == first)
    }

    @Test func readingPastMidnightBelongsToTheDayPassed() {
        // Logged on the second's date, for the first.
        let entry = QuranEntry(day: first, at: second.noonUTC, kind: .read, fromPage: 0, toPage: 4)
        let progress = QuranProgress(entries: [entry])
        #expect(progress.pages(on: first) == 4)
        #expect(progress.pages(on: second) == 0)
    }

    @Test func anEntryRoundTripsAsJSON() throws {
        let entry = read(3, 9, minute: 5)
        #expect(try JSONDecoder().decode(QuranEntry.self, from: JSONEncoder().encode(entry)) == entry)
        #expect(entry.pages == 6)
    }
}

@Suite struct QuranGoalTests {
    private let start = DayKey(year: 2026, month: 11, day: 1)!
    private var end: DayKey { start.adding(days: 29) }
    private var goal: QuranGoal { QuranGoal(start: start, end: end) }

    private func read(_ from: Int, _ to: Int, on day: DayKey) -> QuranEntry {
        QuranEntry(day: day, at: Date(timeIntervalSince1970: Double(to)), kind: .read, fromPage: from, toPage: to)
    }

    @Test func aWholeMushafOverThirtyDays() {
        #expect(goal.standing(today: start, progress: QuranProgress(entries: [])) == .onTheWay(pagesPerDay: 21))
    }

    @Test func whatIsReadTodayCountsAndThePaceRoundsUp() {
        let progress = QuranProgress(entries: [read(0, 104, on: start)])
        #expect(goal.standing(today: start, progress: progress) == .onTheWay(pagesPerDay: 17))
        #expect(goal.standing(today: end, progress: progress) == .onTheWay(pagesPerDay: 500))
    }

    @Test func aKhatmahInTheWindowMeetsIt() {
        let progress = QuranProgress(entries: [read(0, 604, on: start.adding(days: 3))])
        #expect(goal.standing(today: start.adding(days: 3), progress: progress) == .met)
        #expect(goal.standing(today: end.adding(days: 40), progress: progress) == .met)
    }

    @Test func aKhatmahBeforeTheGoalDoesNotMeetIt() {
        let progress = QuranProgress(entries: [read(0, 604, on: start.adding(days: -1))])
        #expect(goal.standing(today: start, progress: progress) == .onTheWay(pagesPerDay: 21))
    }

    @Test func theDateCanGoBy() {
        #expect(goal.standing(today: end.adding(days: 1), progress: QuranProgress(entries: [])) == .passed)
    }

    @Test func aDifferentClockMeansTravel() {
        let cairo = SavedLocation(latitude: 30, longitude: 31, timeZone: "Africa/Cairo", label: "Cairo", countryCode: "EG", source: .gps, updatedAt: 0)
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        #expect(!cairo.keepsDifferentTime(from: TimeZone(identifier: "Africa/Cairo")!, at: now))
        #expect(cairo.keepsDifferentTime(from: TimeZone(identifier: "Asia/Tokyo")!, at: now))
        var nowhere = cairo
        nowhere.timeZone = "Not/AZone"
        #expect(!nowhere.keepsDifferentTime(from: TimeZone(identifier: "Asia/Tokyo")!, at: now))
    }
}

@Suite struct HifzProgressTests {
    private let day = DayKey(year: 2026, month: 11, day: 1)!

    private func entry(_ kind: HifzEntry.Kind, _ sura: Int, _ offset: Int) -> HifzEntry {
        HifzEntry(sura: sura, day: day.adding(days: offset), at: Date(timeIntervalSince1970: Double(offset)), kind: kind)
    }

    @Test func nothingLoggedHoldsNothing() {
        #expect(HifzProgress(entries: []).memorisedCount == 0)
    }

    @Test func aReviewMovesTheDateAndCounts() throws {
        let progress = HifzProgress(entries: [entry(.reviewed, 67, 3), entry(.memorised, 67, 0)])
        let sura = try #require(progress.suras[67])
        #expect(sura.memorisedOn == day)
        #expect(sura.lastReviewedOn == day.adding(days: 3))
        #expect(sura.reviews == 1)
    }

    @Test func forgettingTakesItOutAndRememberingStartsAgain() throws {
        let log = [entry(.memorised, 2, 0), entry(.reviewed, 2, 1), entry(.forgotten, 2, 2)]
        #expect(HifzProgress(entries: log).suras[2] == nil)
        #expect(HifzProgress(entries: log).totalReviews == 1)
        let again = HifzProgress(entries: log + [entry(.memorised, 2, 3)])
        #expect(try #require(again.suras[2]).reviews == 0)
    }

    @Test func theLongestSinceReviewComesFirst() {
        let progress = HifzProgress(entries: [entry(.memorised, 1, 0), entry(.memorised, 2, 1), entry(.reviewed, 1, 5)])
        #expect(progress.byLastReview.map(\.number) == [2, 1])
    }
}
