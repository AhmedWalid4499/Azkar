import AzkarCore
import Foundation
import Testing
@testable import PrayerEngine

@Suite("When each prayer's time ends, as on the website (branch wip/web-seven-features)")
struct DeadlineParityTests {
    struct Row: Decodable {
        let place: Int
        let date: Int
        let ishaEnds: String
        /// Per prayer: [endsAt, preferred] or nil.
        let ends: [[Double?]?]
        /// [key, at, endsAt, preferred]
        let lead10: [[Entry]]
        let lead60: [[Entry]]
    }

    enum Entry: Decodable, Equatable {
        case key(String)
        case number(Double)

        init(from decoder: Decoder) throws {
            let container = try decoder.singleValueContainer()
            if let string = try? container.decode(String.self) {
                self = .key(string)
            } else {
                self = .number(try container.decode(Double.self))
            }
        }
    }

    struct File: Decodable {
        let dates: [String]
        let rows: [Row]
    }

    static let file: File = try! Fixtures.load("deadlines.json")

    @Test("Every prayer's end and every 'not logged yet' reminder, for both ends of Isha and two lead times")
    func everyRowMatches() {
        let file = Self.file
        #expect(file.rows.count == Fixtures.places.count * file.dates.count * 2)
        let places = Fixtures.places.map(\.prayerPlace)
        var mismatches = Mismatches()
        for row in file.rows {
            let place = places[row.place]
            let day = Fixtures.day(file.dates[row.date])
            let ishaEnds = IshaDeadline(rawValue: row.ishaEnds)!
            let today = PrayerCalculator.day(day, at: place, config: .default)
            let next = PrayerCalculator.day(day.adding(days: 1), at: place, config: .default)
            let name = "\(Fixtures.places[row.place].name) \(day) \(ishaEnds)"

            for (index, prayer) in Prayer.allCases.enumerated() {
                let deadline = today.deadline(for: prayer, nextDay: next, ishaEnds: ishaEnds)
                let actual: [Double?]? = deadline.map { [Fixtures.offset($0.endsAt, from: day), $0.preferred ? 1 : 0] }
                if actual != row.ends[index] { mismatches.record("\(name) \(prayer): web \(String(describing: row.ends[index])), native \(String(describing: actual))") }
            }

            for (lead, expected) in [(10, row.lead10), (60, row.lead60)] {
                let choices = UnloggedChoices(leadMinutes: lead, ishaEnds: ishaEnds) { _, _ in false }
                let entries = ReminderPlan.unloggedEntries(days: [today, next], choices: choices).map { entry -> [Entry] in
                    guard case let .unlogged(_, deadline) = entry.kind else { return [] }
                    return [
                        .key(entry.key),
                        .number(Fixtures.offset(entry.at, from: day)!),
                        .number(Fixtures.offset(deadline.endsAt, from: day)!),
                        .number(deadline.preferred ? 1 : 0),
                    ]
                }
                if entries != expected { mismatches.record("\(name) lead \(lead): web \(expected), native \(entries)") }
            }
        }
        #expect(mismatches.isEmpty, "\(mismatches.summary)")
    }
}
