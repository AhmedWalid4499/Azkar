import XCTest

final class WidgetStoreTests: XCTestCase {
    private var store: WidgetStore!

    override func setUpWithError() throws {
        store = WidgetStore(directory: try Fixtures.temporaryDirectory())
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: store.directory)
    }

    private let tapped = Fixtures.utc("2026-10-12T13:05")

    func testHasNothingBeforeTheFirstPublish() throws {
        XCTAssertNil(store.snapshot())
        XCTAssertEqual(try store.takeActions(), [])
    }

    func testKeepsWhatTheAppPublished() throws {
        let snapshot = try Fixtures.snapshot()
        try store.publish(snapshot)
        XCTAssertEqual(store.snapshot(), snapshot)
    }

    func testQueuesATapForTheAppAndShowsThePrayerLoggedAtOnce() throws {
        try store.publish(try Fixtures.snapshot())
        XCTAssertTrue(try store.markPrayed(date: "2026-10-12", prayer: "asr", at: tapped))
        XCTAssertEqual(store.snapshot()?.status(date: "2026-10-12", prayer: "asr"), "ontime")

        let actions = try store.takeActions()
        XCTAssertEqual(actions.count, 1)
        XCTAssertEqual(actions.first?.date, "2026-10-12")
        XCTAssertEqual(actions.first?.prayer, "asr")
        XCTAssertEqual(actions.first?.status, "ontime")
        XCTAssertEqual(actions.first?.at, tapped.timeIntervalSince1970 * 1000)
        XCTAssertFalse(actions.first?.id.isEmpty ?? true)
        // Taken once only.
        XCTAssertEqual(try store.takeActions(), [])
    }

    func testIgnoresATapOnAPrayerAlreadyLoggedOrQueued() throws {
        try store.publish(try Fixtures.snapshot())
        XCTAssertFalse(try store.markPrayed(date: "2026-10-12", prayer: "fajr", at: tapped))
        XCTAssertTrue(try store.markPrayed(date: "2026-10-12", prayer: "asr", at: tapped))
        XCTAssertFalse(try store.markPrayed(date: "2026-10-12", prayer: "asr", at: tapped.addingTimeInterval(60)))
        XCTAssertEqual(try store.takeActions().map(\.prayer), ["asr"])
        XCTAssertEqual(store.snapshot()?.days[0].log["fajr"], "jamaah")
    }

    func testQueuesATapEvenBeforeTheAppHasPublished() throws {
        XCTAssertTrue(try store.markPrayed(date: "2026-10-12", prayer: "maghrib", at: tapped))
        XCTAssertNil(store.snapshot())
        XCTAssertEqual(try store.takeActions().map(\.prayer), ["maghrib"])
    }

    func testAPublishDoesNotUndoATapTheAppHasNotCollected() throws {
        let fromTheApp = try Fixtures.snapshot()
        try store.publish(fromTheApp)
        try store.markPrayed(date: "2026-10-12", prayer: "asr", at: tapped)

        // The app publishes again before it has collected the tap (a language change, say).
        try store.publish(fromTheApp)
        XCTAssertEqual(store.snapshot()?.status(date: "2026-10-12", prayer: "asr"), "ontime")

        // Once collected, the app's own log is what counts.
        _ = try store.takeActions()
        try store.publish(fromTheApp)
        XCTAssertNil(store.snapshot()?.status(date: "2026-10-12", prayer: "asr"))
    }

    func testReturnsTapsOldestFirst() throws {
        try store.markPrayed(date: "2026-10-12", prayer: "maghrib", at: tapped.addingTimeInterval(3600))
        try store.markPrayed(date: "2026-10-12", prayer: "asr", at: tapped)
        XCTAssertEqual(try store.takeActions().map(\.prayer), ["asr", "maghrib"])
    }

    func testCopesWithDamagedFiles() throws {
        try Data("not json".utf8).write(to: store.snapshotURL)
        try Data("{".utf8).write(to: store.actionsURL)
        XCTAssertNil(store.snapshot())
        XCTAssertEqual(try store.takeActions(), [])
        XCTAssertTrue(try store.markPrayed(date: "2026-10-12", prayer: "asr", at: tapped))
        XCTAssertEqual(try store.takeActions().map(\.prayer), ["asr"])
        try store.publish(try Fixtures.snapshot())
        XCTAssertEqual(store.snapshot(), try Fixtures.snapshot())
    }

    func testTwoProcessesTappingAtOnceLoseNothing() throws {
        // The app and the extension each open the files themselves; two stores stand in for them.
        let other = WidgetStore(directory: store.directory)
        let prayers = Prayers.all
        DispatchQueue.concurrentPerform(iterations: 40) { index in
            let date = String(format: "2026-10-%02d", 1 + index / prayers.count)
            let writer = index.isMultiple(of: 2) ? store! : other
            _ = try? writer.markPrayed(date: date, prayer: prayers[index % prayers.count], at: tapped)
        }
        XCTAssertEqual(try store.takeActions().count, 40)
    }
}
