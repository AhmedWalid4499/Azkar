import XCTest

final class WidgetSnapshotTests: XCTestCase {
    func testReadsTheSnapshotTheAppBuilds() throws {
        let snapshot = try Fixtures.snapshot()
        XCTAssertEqual(snapshot.version, WidgetSnapshot.currentVersion)
        XCTAssertEqual(snapshot.lang, "ar")
        XCTAssertTrue(snapshot.arabicDigits)
        XCTAssertEqual(snapshot.timeZone, "Africa/Cairo")
        XCTAssertEqual(snapshot.name, "أحمد")
        XCTAssertEqual(snapshot.days.map(\.date), ["2026-10-12", "2026-10-13"])
        XCTAssertEqual(snapshot.days[0].prayers.map(\.prayer), Prayers.all)
        XCTAssertEqual(snapshot.days[1].prayers.map(\.prayer), ["fajr", "dhuhr", "asr", "maghrib"])
        XCTAssertEqual(snapshot.days[0].prayers[2].date, Fixtures.utc("2026-10-12T12:59"))
        XCTAssertEqual(snapshot.days[0].prayers[2].time, "٣:٥٩ م")
        XCTAssertEqual(snapshot.days[0].log, ["fajr": "jamaah", "dhuhr": "ontime"])
        XCTAssertEqual(snapshot.labels["greeting"], "السلام عليكم يا \u{2068}أحمد\u{2069}")
    }

    func testReadsASnapshotWithoutALocation() throws {
        let json = #"{"version":1,"lang":"en","arabicDigits":false,"timeZone":null,"name":"","days":[],"labels":{}}"#
        let snapshot = try JSONDecoder().decode(WidgetSnapshot.self, from: Data(json.utf8))
        XCTAssertNil(snapshot.timeZone)
        XCTAssertEqual(snapshot.days, [])
    }

    func testRefusesSomethingElse() {
        XCTAssertThrowsError(try JSONDecoder().decode(WidgetSnapshot.self, from: Data(#"{"version":1}"#.utf8)))
        XCTAssertThrowsError(try JSONDecoder().decode(WidgetSnapshot.self, from: Data("[]".utf8)))
    }

    func testMarksAPrayerLoggedOnlyWhenNothingIsLoggedForIt() throws {
        var snapshot = try Fixtures.snapshot()
        snapshot.markLogged(date: "2026-10-12", prayer: "asr", status: "ontime")
        snapshot.markLogged(date: "2026-10-12", prayer: "fajr", status: "ontime")
        snapshot.markLogged(date: "2026-10-20", prayer: "asr", status: "ontime")
        XCTAssertEqual(snapshot.days[0].log, ["fajr": "jamaah", "dhuhr": "ontime", "asr": "ontime"])
        XCTAssertEqual(snapshot.status(date: "2026-10-12", prayer: "asr"), "ontime")
        XCTAssertNil(snapshot.status(date: "2026-10-20", prayer: "asr"))
    }

    func testNamesTheUnloggedReminderAsTheAppSchedulesIt() {
        // 1_000_000_000 + YYYYMMDD * 10 + 0 to 4 for Fajr to Isha.
        XCTAssertEqual(UnloggedReminder.identifier(date: "2026-10-12", prayer: "fajr"), "1202610120")
        XCTAssertEqual(UnloggedReminder.identifier(date: "2026-10-12", prayer: "asr"), "1202610122")
        XCTAssertEqual(UnloggedReminder.identifier(date: "2026-12-31", prayer: "isha"), "1202612314")
        XCTAssertLessThanOrEqual(Int(UnloggedReminder.identifier(date: "2099-12-31", prayer: "isha")!)!, Int(Int32.max))
        XCTAssertNil(UnloggedReminder.identifier(date: "2026-10-12", prayer: "sunrise"))
        XCTAssertNil(UnloggedReminder.identifier(date: "2026-13-12", prayer: "asr"))
        XCTAssertNil(UnloggedReminder.identifier(date: "12-10-2026", prayer: "asr"))
        XCTAssertNil(UnloggedReminder.identifier(date: "", prayer: "asr"))
    }

    func testHandsActionsToTheAppInTheShapeItChecks() {
        let action = PendingAction(id: "a", date: "2026-10-12", prayer: "asr", status: "ontime", at: 1_791_810_300_000)
        let dictionary = action.dictionary
        XCTAssertEqual(dictionary["id"] as? String, "a")
        XCTAssertEqual(dictionary["date"] as? String, "2026-10-12")
        XCTAssertEqual(dictionary["prayer"] as? String, "asr")
        XCTAssertEqual(dictionary["status"] as? String, "ontime")
        XCTAssertEqual(dictionary["at"] as? Double, 1_791_810_300_000)
    }
}
