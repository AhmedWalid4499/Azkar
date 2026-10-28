import XCTest

final class WidgetTextTests: XCTestCase {
    private func slot(_ prayer: String, _ time: String, _ status: String?) -> PrayerSlot {
        PrayerSlot(prayer: prayer, date: "2026-10-12", at: Date(), time: time, status: status)
    }

    func testSpeaksInTheAppsLanguage() throws {
        let text = WidgetText(snapshot: try Fixtures.snapshot())
        XCTAssertTrue(text.isArabic)
        XCTAssertEqual(text.label("nextPrayer"), "الصلاة القادمة")
        XCTAssertEqual(text.prayer("maghrib"), "المغرب")
        XCTAssertEqual(text.greeting, "السلام عليكم يا \u{2068}أحمد\u{2069}")
        XCTAssertEqual(text.rowLabel(slot("fajr", "٥:٢٨ ص", "jamaah")), "الفجر، ٥:٢٨ ص: جماعة")
        XCTAssertEqual(text.rowLabel(slot("asr", "٣:٥٩ م", nil)), "العصر، ٣:٥٩ م: غير مسجَّلة. تسجيلها «في وقتها».")
    }

    func testCountsDownInTheAppsDigits() throws {
        var snapshot = try Fixtures.snapshot()
        XCTAssertEqual(WidgetText(snapshot: snapshot).locale.identifier, "ar@numbers=arab")
        snapshot.arabicDigits = false
        XCTAssertEqual(WidgetText(snapshot: snapshot).locale.identifier, "ar@numbers=latn")
        snapshot.lang = "en"
        XCTAssertEqual(WidgetText(snapshot: snapshot).locale.identifier, "en")
        let formatter = NumberFormatter()
        formatter.locale = WidgetText(snapshot: try Fixtures.snapshot()).locale
        XCTAssertEqual(formatter.string(from: 15), "١٥")
    }

    func testHasNoGreetingWithoutAName() throws {
        var snapshot = try Fixtures.snapshot()
        snapshot.labels["greeting"] = ""
        XCTAssertNil(WidgetText(snapshot: snapshot).greeting)
    }

    func testFallsBackToItsOwnWordingUntilTheAppHasPublished() {
        // The tests run in English.
        let text = WidgetText(snapshot: nil)
        XCTAssertFalse(text.isArabic)
        XCTAssertEqual(text.label("notSetUp"), "Open Azkar to see prayer times here.")
        XCTAssertEqual(text.prayer("isha"), "Isha")
        XCTAssertEqual(text.rowLabel(slot("asr", "3:59 PM", "late")), "Asr, 3:59 PM: Late")
        XCTAssertNil(text.greeting)
    }

    func testItsOwnWordingCoversEveryTextTheAppSends() throws {
        let english = try XCTUnwrap(Bundle.widget.path(forResource: "en", ofType: "lproj").flatMap(Bundle.init(path:)))
        let arabic = try XCTUnwrap(Bundle.widget.path(forResource: "ar", ofType: "lproj").flatMap(Bundle.init(path:)))
        for key in try Fixtures.snapshot().labels.keys where key != "greeting" {
            XCTAssertNotEqual(english.localizedString(forKey: key, value: "MISSING", table: nil), "MISSING", key)
            XCTAssertNotEqual(arabic.localizedString(forKey: key, value: "MISSING", table: nil), "MISSING", key)
        }
    }
}
