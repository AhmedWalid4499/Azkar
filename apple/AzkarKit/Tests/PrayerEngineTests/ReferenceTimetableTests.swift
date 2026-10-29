import AzkarCore
import Foundation
import Testing
@testable import PrayerEngine

/// The website's reference.test.ts: timetables published by others (the Aladhan API and the
/// authorities behind the methods), frozen in its reference.fixtures.ts and exported as is.
@Suite("Against published timetables")
struct ReferenceTimetableTests {
    /// Agreement required with an independent timetable, as on the website.
    static let toleranceMinutes = 2

    struct Case: Decodable, Sendable, CustomTestStringConvertible {
        struct Place: Decodable, Sendable {
            let latitude: Double
            let longitude: Double
            let timeZone: String
        }

        struct Config: Decodable, Sendable {
            let method: String?
            let madhab: String?
            let highLatitudeRule: String?
        }

        let name: String
        let source: String
        let dateKey: String
        let place: Place
        let config: Config
        let expected: [String: String]

        var testDescription: String { "\(name) (\(dateKey))" }
    }

    struct File: Decodable {
        let aladhan: [Case]
        let authority: [Case]
    }

    static let file: File = try! Fixtures.load("reference.json")

    @Test("Within two minutes of the Aladhan API, on the requested day", arguments: ReferenceTimetableTests.file.aladhan)
    func aladhan(_ reference: Case) throws { try check(reference) }

    @Test("Within two minutes of the authorities' own timetables, on the requested day", arguments: ReferenceTimetableTests.file.authority)
    func authority(_ reference: Case) throws { try check(reference) }

    private func check(_ reference: Case) throws {
        let place = try #require(PrayerPlace(latitude: reference.place.latitude, longitude: reference.place.longitude, timeZoneIdentifier: reference.place.timeZone, countryCode: nil))
        var config = CalculationConfig.default
        if let method = reference.config.method { config.method = try #require(AutoOr(rawValue: method)) }
        if let madhab = reference.config.madhab { config.madhab = try #require(AutoOr(rawValue: madhab)) }
        if let rule = reference.config.highLatitudeRule { config.highLatitudeRule = try #require(AutoOr(rawValue: rule)) }
        let day = try #require(DayKey(reference.dateKey))
        let computed = PrayerCalculator.day(day, at: place, config: config)

        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = place.timeZone
        for slot in TimeSlot.allCases {
            let at = try #require(computed[slot], "\(slot) is a real time")
            let clock = try #require(reference.expected[slot.rawValue]).split(separator: ":").compactMap { Int($0) }
            let parts = calendar.dateComponents([.hour, .minute], from: at)
            let difference = parts.hour! * 60 + parts.minute! - (clock[0] * 60 + clock[1])
            #expect(abs(difference) <= Self.toleranceMinutes, "\(slot): computed \(parts.hour!):\(parts.minute!), reference \(clock)")
            // The right clock time on the wrong day would still be a wrong answer.
            #expect(DayKey(at, in: place.timeZone) == day, "\(slot) falls on the requested day")
        }
    }
}
