import Adhan
import AzkarCore
import Foundation
import Testing
@testable import PrayerEngine

/// The engine carries its own port of adhan-js (see AdhanDay.swift). Where adhan-swift 1.5.0 answers
/// at all, the two must agree to the second: an independent check of the port beside the parity with
/// the website. adhan-swift gives up on a whole day when any one time is missing, which is why the
/// engine cannot simply call it (see AdhanDay.swift).
@Suite("Against adhan-swift 1.5.0")
struct AdhanSwiftCrossCheckTests {
    static func adhanMethod(_ method: CalculationMethodID) -> CalculationMethod {
        switch method {
        case .muslimWorldLeague: .muslimWorldLeague
        case .egyptian: .egyptian
        case .ummAlQura: .ummAlQura
        case .dubai: .dubai
        case .kuwait: .kuwait
        case .qatar: .qatar
        case .turkey: .turkey
        case .tehran: .tehran
        case .karachi: .karachi
        case .singapore: .singapore
        case .northAmerica: .northAmerica
        case .moonsightingCommittee: .moonsightingCommittee
        }
    }

    @Test("Every method and school, at every place under 60° and on every grid day, to the second")
    func agreesWithAdhanSwift() throws {
        var gregorian = Calendar(identifier: .gregorian)
        gregorian.timeZone = .gmt
        let days = try Fixtures.load("engine-grid.json", as: EngineParityTests.Grid.self).dates.map(Fixtures.day)
        var compared = 0
        var roundedUp = 0
        var mismatches = Mismatches()
        for place in Fixtures.places where abs(place.latitude) < 60 {
            for day in days {
                for method in CalculationMethodID.allCases {
                    for madhab in AzkarCore.Madhab.allCases {
                        var params = Self.adhanMethod(method).params
                        params.madhab = madhab == .hanafi ? .hanafi : .shafi
                        params.highLatitudeRule = .twilightAngle
                        let components = DateComponents(calendar: gregorian, year: day.year, month: day.month, day: day.day)
                        guard let theirs = PrayerTimes(coordinates: Coordinates(latitude: place.latitude, longitude: place.longitude), date: components, calculationParameters: params) else { continue }
                        let parameters = AdhanParameters(method: MethodParameters(method), madhab: madhab, highLatitudeRule: .twilightAngle, adjustments: MinuteOffsets())
                        let ours = AdhanDay(day: day, latitude: place.latitude, longitude: place.longitude, parameters: parameters)
                        let pairs: [(TimeSlot, Date)] = [(.fajr, theirs.fajr), (.sunrise, theirs.sunrise), (.dhuhr, theirs.dhuhr), (.asr, theirs.asr), (.maghrib, theirs.maghrib), (.isha, theirs.isha)]
                        for (slot, their) in pairs {
                            compared += 1
                            let mine = JS.toDate(ours[slot])
                            guard let mine else {
                                mismatches.record("\(place.name) \(day) \(method) \(madhab) \(slot): adhan-swift \(their), port missing")
                                continue
                            }
                            let difference = mine.timeIntervalSince(their)
                            // Singapore rounds up. adhan-js (the website's) adds a whole minute to a time whose
                            // seconds are zero; adhan-swift's ceiling leaves it. The website's way is kept.
                            if method == .singapore, (60..<61).contains(difference) {
                                roundedUp += 1
                                continue
                            }
                            if abs(difference) >= 1 {
                                mismatches.record("\(place.name) \(day) \(method) \(madhab) \(slot): adhan-swift \(their), port \(mine)")
                            }
                        }
                    }
                }
            }
        }
        #expect(compared > 50_000)
        // About one Singapore time in sixty has zero seconds.
        #expect(roundedUp > 0 && roundedUp * 30 < compared / CalculationMethodID.allCases.count)
        #expect(mismatches.isEmpty, "\(mismatches.summary)")
    }
}
