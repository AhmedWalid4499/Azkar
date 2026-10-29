import AzkarCore
import Foundation
@testable import PrayerEngine

/// The JSON the website's own engine wrote (scripts/native/engine/generate.fixtures.ts).
/// Instants are milliseconds from noon UTC of the case's day; `nil` is a time that does not exist.
enum Fixtures {
    static let directory = URL(fileURLWithPath: #filePath)
        .deletingLastPathComponent().deletingLastPathComponent()
        .appending(path: "Fixtures")

    static func load<T: Decodable>(_ name: String, as type: T.Type = T.self) throws -> T {
        try JSONDecoder().decode(T.self, from: Data(contentsOf: directory.appending(path: name)))
    }

    struct Place: Decodable, Sendable {
        let name: String
        let latitude: Double
        let longitude: Double
        let timeZone: String
        let countryCode: String?

        var prayerPlace: PrayerPlace {
            PrayerPlace(latitude: latitude, longitude: longitude, timeZoneIdentifier: timeZone, countryCode: countryCode)!
        }
    }

    struct WebAdjustments: Decodable, Hashable, Sendable {
        let fajr, sunrise, dhuhr, asr, maghrib, isha: Int
    }

    /// A `CalculationConfig` as the website writes it.
    struct WebConfig: Decodable, Hashable, Sendable {
        let method: String
        let madhab: String
        let highLatitudeRule: String
        let polar: String
        let adjustments: WebAdjustments

        var config: CalculationConfig {
            CalculationConfig(
                method: AutoOr(rawValue: method)!,
                madhab: AutoOr(rawValue: madhab)!,
                highLatitudeRule: AutoOr(rawValue: highLatitudeRule)!,
                polar: PolarSetting(rawValue: polar)!,
                adjustments: Adjustments(
                    fajr: adjustments.fajr, sunrise: adjustments.sunrise, dhuhr: adjustments.dhuhr,
                    asr: adjustments.asr, maghrib: adjustments.maghrib, isha: adjustments.isha
                )
            )
        }
    }

    static let places: [Place] = try! load("places.json")

    static func day(_ string: String) -> DayKey { DayKey(string)! }

    /// Milliseconds since 1970 of noon UTC on `day`.
    static func noon(_ day: DayKey) -> Double { JS.instant(day.noonUTC) }

    static func date(_ offset: Double, from day: DayKey) -> Date {
        Date(timeIntervalSince1970: (noon(day) + offset) / 1000)
    }

    /// The offset a time is written as, or `nil` when it does not exist.
    static func offset(_ date: Date?, from day: DayKey) -> Double? {
        date.map { JS.instant($0) - noon(day) }
    }
}

/// A list of differences, reported a few at a time.
struct Mismatches {
    private(set) var count = 0
    private(set) var first: [String] = []

    mutating func record(_ description: @autoclosure () -> String) {
        count += 1
        if first.count < 15 { first.append(description()) }
    }

    var isEmpty: Bool { count == 0 }
    var summary: String { "\(count) differences, first: \n" + first.joined(separator: "\n") }
}

/// One cell of a fixture row that mixes strings, numbers and nulls.
enum FixtureValue: Decodable, Hashable, CustomStringConvertible {
    case text(String)
    case number(Double)
    case null

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self = .null
        } else if let number = try? container.decode(Double.self) {
            self = .number(number)
        } else {
            self = .text(try container.decode(String.self))
        }
    }

    init(_ number: Double?) { self = number.map(FixtureValue.number) ?? .null }

    var description: String {
        switch self {
        case let .text(text): "\"\(text)\""
        case let .number(number): "\(number)"
        case .null: "null"
        }
    }
}
