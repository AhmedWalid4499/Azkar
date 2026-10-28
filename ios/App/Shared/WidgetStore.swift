import Foundation

/// The two files the app and its widget extension share in the App Group container: the
/// snapshot the app publishes, and the prayers marked on a widget that the app has yet to
/// record. The app and the extension are separate processes, so every read and every
/// change goes through file coordination, and a change reads and writes both files as one.
final class WidgetStore {
    static let appGroup = "group.io.github.ahmedwalid4499.azkar"

    let directory: URL
    var snapshotURL: URL { directory.appendingPathComponent("widget-snapshot.json") }
    var actionsURL: URL { directory.appendingPathComponent("widget-actions.json") }

    init(directory: URL) {
        self.directory = directory
    }

    /// The App Group's store, or nil when the build was signed without the App Group.
    static func shared() -> WidgetStore? {
        FileManager.default
            .containerURL(forSecurityApplicationGroupIdentifier: appGroup)
            .map { WidgetStore(directory: $0) }
    }

    /// The last snapshot published, with any taps on a widget since; nil before the first.
    func snapshot() -> WidgetSnapshot? {
        var snapshot: WidgetSnapshot?
        var coordinationError: NSError?
        NSFileCoordinator().coordinate(readingItemAt: snapshotURL, options: [], error: &coordinationError) { url in
            snapshot = Self.read(WidgetSnapshot.self, at: url)
        }
        return snapshot
    }

    /// Saves what the app published. A prayer marked on a widget that the app has not
    /// collected yet stays shown as logged, so a tap never seems to come undone.
    func publish(_ snapshot: WidgetSnapshot) throws {
        try change { actions, saved in
            var published = snapshot
            for action in actions {
                published.markLogged(date: action.date, prayer: action.prayer, status: action.status)
            }
            saved = published
        }
    }

    /// Marks a prayer prayed on time from a widget: queued for the app, and shown as logged
    /// at once. False, and nothing changes, when it is already logged or already queued.
    @discardableResult
    func markPrayed(date: String, prayer: String, at: Date) throws -> Bool {
        var queued = false
        try change { actions, snapshot in
            if snapshot?.status(date: date, prayer: prayer) != nil { return }
            if actions.contains(where: { $0.date == date && $0.prayer == prayer }) { return }
            let tapped = (at.timeIntervalSince1970 * 1000).rounded()
            actions.append(PendingAction(id: UUID().uuidString, date: date, prayer: prayer, status: "ontime", at: tapped))
            snapshot?.markLogged(date: date, prayer: prayer, status: "ontime")
            queued = true
        }
        return queued
    }

    /// The prayers marked on a widget since the last call, oldest first. They are removed
    /// here as they are returned: the caller records them.
    func takeActions() throws -> [PendingAction] {
        var taken: [PendingAction] = []
        try change { actions, _ in
            taken = actions.sorted { $0.at < $1.at }
            actions = []
        }
        return taken
    }

    /// Reads both files, lets `body` change them, and writes back what changed, all while
    /// holding both for writing so that no other process can come in between.
    private func change(_ body: (inout [PendingAction], inout WidgetSnapshot?) throws -> Void) throws {
        var coordinationError: NSError?
        var failure: Error?
        NSFileCoordinator().coordinate(
            writingItemAt: actionsURL, options: .forMerging,
            writingItemAt: snapshotURL, options: .forMerging,
            error: &coordinationError
        ) { actionsURL, snapshotURL in
            do {
                let actionsBefore = Self.read([PendingAction].self, at: actionsURL) ?? []
                let snapshotBefore = Self.read(WidgetSnapshot.self, at: snapshotURL)
                var actions = actionsBefore
                var snapshot = snapshotBefore
                try body(&actions, &snapshot)
                if actions != actionsBefore { try Self.write(actions, to: actionsURL) }
                if let snapshot, snapshot != snapshotBefore { try Self.write(snapshot, to: snapshotURL) }
            } catch {
                failure = error
            }
        }
        if let error = coordinationError ?? failure { throw error }
    }

    private static func read<Value: Decodable>(_ type: Value.Type, at url: URL) -> Value? {
        guard let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode(type, from: data)
    }

    private static func write<Value: Encodable>(_ value: Value, to url: URL) throws {
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        try JSONEncoder().encode(value).write(to: url, options: .atomic)
    }
}
