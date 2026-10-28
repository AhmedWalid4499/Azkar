import Foundation
import Testing
@testable import AzkarKit

@Suite("DayKey")
struct DayKeyTests {
    @Test("Reads the day in the requested zone, not the device's")
    func zone() throws {
        let instant = try #require(ISO8601DateFormatter().date(from: "2026-03-10T22:30:00Z"))
        #expect(DayKey(instant, in: TimeZone(identifier: "UTC")!).description == "2026-03-10")
        #expect(DayKey(instant, in: TimeZone(identifier: "Asia/Tokyo")!).description == "2026-03-11")
        #expect(DayKey(instant, in: TimeZone(identifier: "America/Los_Angeles")!).description == "2026-03-10")
    }

    @Test("Parses only real days written as the website writes them")
    func parsing() {
        #expect(DayKey("2026-02-28") != nil)
        #expect(DayKey("2026-02-30") == nil)
        #expect(DayKey("2026-2-3") == nil)
        #expect(DayKey("nope") == nil)
        #expect(DayKey("2028-02-29")?.description == "2028-02-29")
    }

    @Test("Arithmetic across month, year and leap-day boundaries")
    func arithmetic() throws {
        let key = try #require(DayKey("2026-01-31"))
        #expect(key.adding(days: 1).description == "2026-02-01")
        #expect(try #require(DayKey("2026-01-01")).adding(days: -1).description == "2025-12-31")
        #expect(try #require(DayKey("2026-03-01")).days(to: try #require(DayKey("2026-03-08"))) == 7)
        #expect(try #require(DayKey("2026-10-11")).weekday == 1)
    }

    @Test("Encodes as the plain string")
    func coding() throws {
        let data = try JSONEncoder().encode([try #require(DayKey("2026-10-12"))])
        #expect(String(decoding: data, as: UTF8.self) == "[\"2026-10-12\"]")
        #expect(try JSONDecoder().decode([DayKey].self, from: data).first?.description == "2026-10-12")
        #expect(throws: DecodingError.self) { try JSONDecoder().decode([DayKey].self, from: Data("[\"2026-13-01\"]".utf8)) }
    }
}
