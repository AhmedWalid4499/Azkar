import Foundation
import XCTest

private final class TestBundleToken {}

enum Fixtures {
    /// The snapshot the app builds for a known day (src/features/widget/snapshot.fixture.json, which
    /// src/features/widget/snapshot.test.ts checks the app still produces): Cairo, 12 and 13 October
    /// 2026, in Arabic with Arabic-Indic digits, Fajr and Dhuhr of the 12th logged, no Isha on the 13th.
    static func snapshot() throws -> WidgetSnapshot {
        let bundle = Bundle(for: TestBundleToken.self)
        let url = try XCTUnwrap(bundle.url(forResource: "snapshot.fixture", withExtension: "json"))
        return try JSONDecoder().decode(WidgetSnapshot.self, from: Data(contentsOf: url))
    }

    /// An instant written in UTC, "2026-10-12T07:00".
    static func utc(_ text: String) -> Date {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(identifier: "UTC")
        formatter.dateFormat = "yyyy-MM-dd'T'HH:mm"
        guard let date = formatter.date(from: text) else { preconditionFailure("Not an instant: \(text)") }
        return date
    }

    static func temporaryDirectory() throws -> URL {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        return url
    }
}
