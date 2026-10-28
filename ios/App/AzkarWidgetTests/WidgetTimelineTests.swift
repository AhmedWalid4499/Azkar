import WidgetKit
import XCTest

final class WidgetTimelineTests: XCTestCase {
    private func ready(_ content: WidgetContent, file: StaticString = #filePath, line: UInt = #line)
        -> (next: PrayerSlot, tomorrow: Bool, today: [PrayerSlot])? {
        guard case let .ready(next, tomorrow, today) = content else {
            XCTFail("Expected prayers to show, got \(content)", file: file, line: line)
            return nil
        }
        return (next, tomorrow, today)
    }

    func testShowsTheNextPrayerAndTodaysFive() throws {
        // 10:00 in Cairo.
        let shown = try XCTUnwrap(ready(WidgetTimeline.content(of: try Fixtures.snapshot(), at: Fixtures.utc("2026-10-12T07:00"))))
        XCTAssertEqual(shown.next.prayer, "dhuhr")
        XCTAssertEqual(shown.next.time, "١٢:٤٣ م")
        XCTAssertEqual(shown.next.at, Fixtures.utc("2026-10-12T09:43"))
        XCTAssertFalse(shown.tomorrow)
        XCTAssertEqual(shown.today.map(\.prayer), Prayers.all)
        XCTAssertEqual(shown.today.map(\.status), ["jamaah", "ontime", nil, nil, nil])
        XCTAssertEqual(Set(shown.today.map(\.date)), ["2026-10-12"])
    }

    func testAPrayerWhoseTimeHasComeIsNoLongerNext() throws {
        let content = WidgetTimeline.content(of: try Fixtures.snapshot(), at: Fixtures.utc("2026-10-12T09:43"))
        XCTAssertEqual(ready(content)?.next.prayer, "asr")
    }

    func testAfterIshaTheNextIsTomorrowsFajrWhileTheDayLasts() throws {
        // 20:00 in Cairo.
        let shown = try XCTUnwrap(ready(WidgetTimeline.content(of: try Fixtures.snapshot(), at: Fixtures.utc("2026-10-12T17:00"))))
        XCTAssertEqual(shown.next.prayer, "fajr")
        XCTAssertEqual(shown.next.date, "2026-10-13")
        XCTAssertTrue(shown.tomorrow)
        XCTAssertEqual(Set(shown.today.map(\.date)), ["2026-10-12"])
    }

    func testANewDayBeginsAtMidnightAtTheSavedPlace() throws {
        // 00:30 on the 13th in Cairo, still the 12th in UTC.
        let shown = try XCTUnwrap(ready(WidgetTimeline.content(of: try Fixtures.snapshot(), at: Fixtures.utc("2026-10-12T21:30"))))
        XCTAssertEqual(Set(shown.today.map(\.date)), ["2026-10-13"])
        XCTAssertEqual(shown.today.map(\.prayer), ["fajr", "dhuhr", "asr", "maghrib"])
        XCTAssertFalse(shown.tomorrow)
    }

    func testAnIshaAfterMidnightStaysWithItsOwnDay() throws {
        var snapshot = try Fixtures.snapshot()
        // At high latitudes in summer, the 12th's Isha at 00:30 on the 13th.
        snapshot.days[0].prayers[4].at = Fixtures.utc("2026-10-12T21:30").timeIntervalSince1970 * 1000
        let shown = try XCTUnwrap(ready(WidgetTimeline.content(of: snapshot, at: Fixtures.utc("2026-10-12T21:10"))))
        XCTAssertEqual(shown.next.prayer, "isha")
        XCTAssertEqual(shown.next.date, "2026-10-12")
        XCTAssertFalse(shown.tomorrow)
        XCTAssertEqual(Set(shown.today.map(\.date)), ["2026-10-13"])
    }

    func testSaysSoWhenItHasNothingToShow() throws {
        XCTAssertEqual(WidgetTimeline.content(of: nil, at: Date()), .notSetUp)

        var noLocation = try Fixtures.snapshot()
        noLocation.timeZone = nil
        noLocation.days = []
        XCTAssertEqual(WidgetTimeline.content(of: noLocation, at: Date()), .noLocation)

        // After the last published prayer, and on a day that was not published.
        let snapshot = try Fixtures.snapshot()
        XCTAssertEqual(WidgetTimeline.content(of: snapshot, at: Fixtures.utc("2026-10-13T15:30")), .outOfDate)
        XCTAssertEqual(WidgetTimeline.content(of: snapshot, at: Fixtures.utc("2026-10-11T12:00")), .outOfDate)
    }

    func testChangesAtEachPrayerTimeAndEachMidnight() throws {
        let now = Fixtures.utc("2026-10-12T07:00")
        let dates = WidgetTimeline.entryDates(for: try Fixtures.snapshot(), from: now)
        XCTAssertEqual(dates, [
            now,
            Fixtures.utc("2026-10-12T09:43"),
            Fixtures.utc("2026-10-12T12:59"),
            Fixtures.utc("2026-10-12T15:28"),
            Fixtures.utc("2026-10-12T16:45"),
            // Midnight in Cairo, UTC+3.
            Fixtures.utc("2026-10-12T21:00"),
            Fixtures.utc("2026-10-13T02:29"),
            Fixtures.utc("2026-10-13T09:42"),
            Fixtures.utc("2026-10-13T12:58"),
            Fixtures.utc("2026-10-13T15:27"),
        ])
    }

    func testAskedAgainAtTheEndOfItsTimelineOrWaitsForTheApp() throws {
        let now = Fixtures.utc("2026-10-12T07:00")
        let timeline = PrayerTimesProvider.timeline(for: try Fixtures.snapshot(), from: now)
        XCTAssertEqual(timeline.entries.count, 10)
        XCTAssertEqual(timeline.entries.first?.date, now)
        XCTAssertEqual(timeline.entries.last?.content, .outOfDate)
        XCTAssertEqual(String(describing: timeline.policy), String(describing: TimelineReloadPolicy.atEnd))

        let waiting = PrayerTimesProvider.timeline(for: nil, from: now)
        XCTAssertEqual(waiting.entries.map(\.content), [.notSetUp])
        XCTAssertEqual(String(describing: waiting.policy), String(describing: TimelineReloadPolicy.never))
    }

    func testTheGallerySampleShowsPrayers() {
        let now = Date()
        XCTAssertTrue(WidgetTimeline.content(of: SampleSnapshot.make(around: now), at: now).isReady)
    }
}
