import AzkarCore
import Foundation
import Testing
@testable import AzkarStore

/// The fixtures scripts/native/store/generate.test.ts writes by running the website's own stores.
enum Fixtures {
    static let directory = URL(fileURLWithPath: #filePath)
        .deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
        .deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
        .appending(path: "scripts/native/store/fixtures")

    static func data(_ name: String) throws -> Data {
        try Data(contentsOf: directory.appending(path: name))
    }

    static func json(_ name: String) throws -> JSONValue {
        try JSONDecoder().decode(JSONValue.self, from: data(name))
    }

    /// The real dataset's sessions when the fixtures were made (the website's `targetOf` for each dhikr).
    static let catalog: StaticSessionCatalog = {
        let file = try! json("catalog.json")
        var sessions: [AzkarSession: [DhikrTarget]] = [:]
        for (key, items) in file["sessions"]?.object ?? [:] {
            sessions[AzkarSession(key)!] = (items.array ?? []).map {
                DhikrTarget(id: $0["id"]!.string!, target: Int($0["target"]!.number!))
            }
        }
        return StaticSessionCatalog(sessions: sessions)
    }()

    /// What the website loads for `raw`, as `WebStores.read` sees the strings.
    static func entries(_ raw: JSONValue?) -> [String: StoredEntry] {
        var entries: [String: StoredEntry] = [:]
        for (key, value) in raw?.object ?? [:] {
            if let text = value.string { entries[key] = StoredEntry(text) }
        }
        return entries
    }
}

/// A store in memory, refusing days by the given zone.
func makeStore(catalog: any SessionCatalog = Fixtures.catalog, zone: String = "UTC") throws -> RecordStore {
    let timeZone = TimeZone(identifier: zone)!
    return RecordStore(container: try StoreContainer.open(.inMemory).container, catalog: catalog, timeZone: { timeZone }, postsNotifications: false)
}

/// Settings in a fresh, private defaults domain.
func makeSettings() -> SettingsStore {
    let suite = "AzkarStoreTests.\(UUID().uuidString)"
    return SettingsStore(defaults: UserDefaults(suiteName: suite)!, postsNotifications: false)
}

func day(_ text: String) -> DayKey { DayKey(text)! }

/// An instant from an ISO 8601 string ("2026-09-01T05:10:00Z" or with milliseconds).
func instant(_ text: String) -> Date {
    (try? Date.ISO8601FormatStyle(includingFractionalSeconds: true).parse(text)) ?? (try! Date.ISO8601FormatStyle().parse(text))
}

/// Records a readable difference between two JSON values, path by path.
func expectSameJSON(_ actual: JSONValue?, _ expected: JSONValue?, _ label: String, sourceLocation: SourceLocation = #_sourceLocation) {
    var differences: [String] = []
    func walk(_ a: JSONValue?, _ b: JSONValue?, _ path: String) {
        guard differences.count < 20 else { return }
        if case let .object(x) = a, case let .object(y) = b {
            for key in Set(x.keys).union(y.keys).sorted() { walk(x[key], y[key], "\(path).\(key)") }
        } else if a != b {
            differences.append("\(path): \(a?.text ?? "absent") ≠ expected \(b?.text ?? "absent")")
        }
    }
    walk(actual, expected, label)
    #expect(differences.isEmpty, "\(differences.joined(separator: "\n"))", sourceLocation: sourceLocation)
}

extension JSONValue {
    /// Only the keys named (the fields the website's main branch has).
    func only(_ keys: [String]) -> JSONValue {
        .object((object ?? [:]).filter { keys.contains($0.key) })
    }
}
