import AzkarCore
import Foundation
import Testing
@testable import PrayerEngine

@Suite("Automatic settings, as the website resolves them")
struct ResolutionParityTests {
    struct Resolution: Decodable {
        let zoneTableSize: Int
        let countryTableSize: Int
        let places: [[String]]
        /// [countryCode, timeZone, method, madhab]
        let contexts: [[String?]]
        let angles: [String: Angles]
    }

    struct Angles: Decodable {
        let fajrAngle: Double
        let ishaAngle: Double
        let ishaInterval: Double
    }

    static let resolution: Resolution = try! Fixtures.load("resolution.json")

    @Test("Each grid place resolves 'automatic' to the website's method and Asr school")
    func places() {
        for (place, expected) in zip(Fixtures.places, Self.resolution.places) {
            let resolved = CalculationConfig.default.resolved(at: place.prayerPlace)
            #expect(resolved.method.rawValue == expected[0], "\(place.name)")
            #expect(resolved.madhab.rawValue == expected[1], "\(place.name)")
            #expect(resolved.highLatitudeRule == .twilightAngle)
        }
    }

    @Test("Every zone of the website's fallback table, and every country, gives the same answer")
    func contexts() {
        #expect(PlaceCountry.zoneCountry.count == Self.resolution.zoneTableSize)
        #expect(PlaceCountry.method.count == Self.resolution.countryTableSize)
        // The raw values, as the website's `autoMethod` and `autoMadhab` are given them: some of these
        // zones do not exist, which a `PrayerPlace` would replace by the device's (see below).
        for context in Self.resolution.contexts {
            #expect(CalculationMethodID.automatic(countryCode: context[0], timeZoneIdentifier: context[1]).rawValue == context[2], "\(context)")
            #expect(Madhab.automatic(countryCode: context[0], timeZoneIdentifier: context[1]).rawValue == context[3], "\(context)")
            if let place = PrayerPlace(latitude: 0, longitude: 0, timeZoneIdentifier: context[1]!, countryCode: context[0]),
               place.timeZoneIdentifier == context[1] {
                #expect(CalculationMethodID.automatic(at: place).rawValue == context[2], "\(context)")
                #expect(Madhab.automatic(at: place).rawValue == context[3], "\(context)")
            }
        }
        #expect(CalculationMethodID.automatic(at: nil) == .muslimWorldLeague)
        #expect(Madhab.automatic(at: nil) == .shafi)
    }

    @Test("A saved zone that does not exist is replaced by the device's, as the website's toPlace does, and decides 'automatic' from there")
    func unknownZoneTakesTheDevicesZone() throws {
        let place = try #require(PrayerPlace(latitude: 30, longitude: 31, timeZoneIdentifier: "Etc/Unknown", countryCode: nil))
        #expect(place.timeZoneIdentifier == TimeZone.current.identifier)
        #expect(place.timeZone == TimeZone.current)
        #expect(CalculationMethodID.automatic(at: place) == CalculationMethodID.automatic(countryCode: nil, timeZoneIdentifier: TimeZone.current.identifier))
        // A country saved with the place still wins over any zone.
        let withCountry = try #require(PrayerPlace(latitude: 30, longitude: 31, timeZoneIdentifier: "Etc/Unknown", countryCode: "pk"))
        #expect(CalculationConfig.default.resolved(at: withCountry) == ResolvedCalculation(method: .karachi, madhab: .hanafi, highLatitudeRule: .twilightAngle))
    }

    @Test("Coordinates that are not on the Earth give no place, as the website's isValidCoordinate refuses them")
    func invalidCoordinates() {
        for (latitude, longitude) in [(90.5, 0.0), (-91, 0), (0, 180.01), (0, -181), (.nan, 0), (0, .infinity)] {
            #expect(PrayerPlace(latitude: latitude, longitude: longitude, timeZoneIdentifier: "UTC", countryCode: nil) == nil, "\(latitude), \(longitude)")
        }
        #expect(PrayerPlace(latitude: 90, longitude: -180, timeZoneIdentifier: "UTC", countryCode: nil) != nil)
    }

    @Test("A setting chosen by hand is kept as it is")
    func fixedSettings() {
        let karachi = PrayerPlace(latitude: 24.86, longitude: 67.0, timeZoneIdentifier: "Asia/Karachi", countryCode: "PK")!
        let config = CalculationConfig(method: .fixed(.egyptian), madhab: .fixed(.shafi), highLatitudeRule: .fixed(.seventhOfTheNight))
        #expect(config.resolved(at: karachi) == ResolvedCalculation(method: .egyptian, madhab: .shafi, highLatitudeRule: .seventhOfTheNight))
        #expect(CalculationConfig.default.resolved(at: karachi) == ResolvedCalculation(method: .karachi, madhab: .hanafi, highLatitudeRule: .twilightAngle))
    }

    @Test("The angles Settings explains each method with are the website's")
    func angles() {
        for method in CalculationMethodID.allCases {
            let expected = Self.resolution.angles[method.rawValue]!
            #expect(method.angles == MethodAngles(fajrAngle: expected.fajrAngle, ishaAngle: expected.ishaAngle, ishaInterval: expected.ishaInterval), "\(method)")
        }
    }
}
