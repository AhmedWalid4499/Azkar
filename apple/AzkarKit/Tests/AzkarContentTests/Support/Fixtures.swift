import AzkarCore
import Foundation
@testable import AzkarContent

/// The parity fixtures written by `scripts/native/content/parity.gen.ts`, which runs the
/// website's own code. They live beside the generator, outside the test target.
enum Fixtures {
    static let repo = URL(fileURLWithPath: #filePath).resolvingSymlinksInPath()
        .deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
        .deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()

    static func url(_ name: String) -> URL {
        repo.appending(path: "scripts/native/content/fixtures/\(name)")
    }

    static func load<T: Decodable>(_ type: T.Type, _ name: String) throws -> T {
        try JSONDecoder().decode(T.self, from: Data(contentsOf: url(name)))
    }
}

/// An epoch-milliseconds instant as the website stores it.
func instant(_ milliseconds: Double) -> Date { Date(timeIntervalSince1970: milliseconds / 1000) }

func day(_ string: String) -> DayKey { DayKey(string)! }

// MARK: - The website's stored shapes

/// A session record as the website stores it.
struct WebSession: Decodable {
    var startedAt: Double?
    var lastAt: Double?
    var completedAt: Double?
    var completed: Bool
    var done: Int
    var total: Int
    var recitations: Int

    var record: SessionRecord {
        SessionRecord(
            startedAt: startedAt.map(instant), lastAt: lastAt.map(instant), completedAt: completedAt.map(instant),
            completed: completed, done: done, total: total, recitations: recitations
        )
    }
}

enum WebData {
    static func prayers(
        entries: [String: [String: String]], loggedAt: [String: [String: Double]], sunnah: [String: [String: Double]]
    ) -> PrayerHistory {
        var history: PrayerHistory = [:]
        for (key, log) in entries {
            var record = history[day(key)] ?? DayPrayerRecord()
            for (name, status) in log {
                let prayer = Prayer(rawValue: name)!
                record.prayers[prayer] = PrayerEntry(status: PrayerStatus(rawValue: status)!, loggedAt: loggedAt[key]?[name].map(instant))
            }
            history[day(key)] = record
        }
        for (key, ticks) in sunnah {
            var record = history[day(key)] ?? DayPrayerRecord()
            for (name, at) in ticks { record.sunnah[SunnahPrayer(rawValue: name)!] = instant(at) }
            history[day(key)] = record
        }
        return history
    }

    static func sessions(_ web: [String: [String: WebSession]]) -> SessionHistory {
        Dictionary(uniqueKeysWithValues: web.map { key, sessions in
            (day(key), Dictionary(uniqueKeysWithValues: sessions.map { (AzkarSession($0.key)!, $0.value.record) }))
        })
    }
}

/// `{ current, best }` on the website.
struct WebStreak: Decodable, Equatable {
    var current: Int
    var best: Int

    var streak: Streak { Streak(current: current, best: best) }
}
