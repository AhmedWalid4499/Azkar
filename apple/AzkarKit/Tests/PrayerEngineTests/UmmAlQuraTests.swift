import AzkarCore
import Foundation
import Testing
@testable import PrayerEngine

@Suite("Umm al-Qura Ramadan")
struct UmmAlQuraTests {
    struct File: Decodable {
        let from: String
        let to: String
        let runs: [[String]]
    }

    @Test("Ramadan falls on exactly the website's days, 2000 to 2076")
    func sameDaysAsTheWebsite() throws {
        let file: File = try Fixtures.load("ramadan.json")
        let runs = file.runs.map { (Fixtures.day($0[0]), Fixtures.day($0[1])) }
        #expect(runs.count > 70)
        var mismatches = Mismatches()
        var day = Fixtures.day(file.from)
        let last = Fixtures.day(file.to)
        while day <= last {
            let expected = runs.contains { $0.0 <= day && day <= $0.1 }
            if UmmAlQura.isRamadan(day) != expected { mismatches.record("\(day): web \(expected)") }
            day = day.adding(days: 1)
        }
        #expect(mismatches.isEmpty, "\(mismatches.summary)")
    }

    @Test("Knows the month of 1447: 18 February to 19 March 2026")
    func ramadan1447() {
        #expect(!UmmAlQura.isRamadan(Fixtures.day("2026-02-17")))
        #expect(UmmAlQura.isRamadan(Fixtures.day("2026-02-18")))
        #expect(UmmAlQura.isRamadan(Fixtures.day("2026-03-19")))
        #expect(!UmmAlQura.isRamadan(Fixtures.day("2026-03-20")))
    }
}
