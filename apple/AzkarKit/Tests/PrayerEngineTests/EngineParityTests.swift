import AzkarCore
import Foundation
import Testing
@testable import PrayerEngine

/// The website's engine, run over the grid in scripts/native/engine/grid.ts, against this one.
@Suite("Parity with the website's engine")
struct EngineParityTests {
    struct Grid: Decodable {
        let slots: [String]
        let dates: [String]
        let configs: [Fixtures.WebConfig]
        let cases: [[Double?]]
    }

    static let grid: Grid = try! Fixtures.load("engine-grid.json")

    @Test("The grid is as broad as promised: 40+ places, 30+ days, every method, school and rule")
    func gridIsBroad() {
        let grid = Self.grid
        #expect(Fixtures.places.count >= 40)
        #expect(grid.dates.count >= 30)
        let configs = grid.configs.map(\.config)
        #expect(Set(configs.map(\.method.rawValue)) == Set(["auto"] + CalculationMethodID.allCases.map(\.rawValue)))
        #expect(Set(configs.map(\.madhab.rawValue)) == ["auto", "shafi", "hanafi"])
        #expect(Set(configs.map(\.highLatitudeRule.rawValue)) == Set(["auto"] + HighLatitudeRuleID.allCases.map(\.rawValue)))
        #expect(Set(configs.map(\.polar)) == Set(PolarSetting.allCases))
        #expect(configs.contains { $0.adjustments != .none })
        #expect(grid.slots == TimeSlot.allCases.map(\.rawValue))
        #expect(grid.cases.count > 30_000)
        // Missing times and the fractions of a second adhan leaves behind are both in it.
        #expect(grid.cases.contains { $0[3...].contains { $0 == nil } })
        #expect(grid.cases.contains { $0[3...].contains { ($0 ?? 0).truncatingRemainder(dividingBy: 1000) != 0 } })
    }

    @Test("Every time of every case is the very instant the website computes, or missing on both")
    func everyTimeMatches() {
        let grid = Self.grid
        let places = Fixtures.places.map(\.prayerPlace)
        let configs = grid.configs.map(\.config)
        let days = grid.dates.map(Fixtures.day)
        var mismatches = Mismatches()
        for row in grid.cases {
            let place = places[Int(row[0]!)]
            let day = days[Int(row[1]!)]
            let config = configs[Int(row[2]!)]
            let computed = PrayerCalculator.day(day, at: place, config: config)
            for (index, slot) in TimeSlot.allCases.enumerated() {
                let expected = row[3 + index]
                let actual = Fixtures.offset(computed[slot], from: day)
                if actual != expected {
                    mismatches.record("\(Fixtures.places[Int(row[0]!)].name) \(day) \(grid.configs[Int(row[2]!)]) \(slot): web \(String(describing: expected)), native \(String(describing: actual))")
                }
            }
        }
        #expect(mismatches.isEmpty, "\(mismatches.summary)")
    }

    @Test("The device's own zone plays no part: the process runs in the zone TZ names")
    func runsInTheZoneTZNames() {
        // `swift test` is run with TZ set to several zones (see the module's report); this checks the
        // setting reached Foundation, so the parity above really was proven from that zone.
        guard let zone = ProcessInfo.processInfo.environment["TZ"], !zone.isEmpty else { return }
        #expect(TimeZone.current.secondsFromGMT(for: Date(timeIntervalSince1970: 1_768_478_400)) == TimeZone(identifier: zone)?.secondsFromGMT(for: Date(timeIntervalSince1970: 1_768_478_400)))
    }
}
