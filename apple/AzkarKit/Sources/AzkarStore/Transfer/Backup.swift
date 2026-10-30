import AzkarCore
import Foundation

/// Backup files in the website's format (src/shared/storage.ts): `{ app: "azkar", version: 1,
/// exportedAt, data: { "azkar:<store>": <the store's saved JSON> } }`. A file exported here
/// opens on the website, and one exported by the website opens here.
public enum Backup {
    public enum Failure: Error, Hashable, Sendable {
        case notJSON
        /// JSON, but not an Azkar backup (`isBackupFile` refuses it).
        case notABackup
    }

    /// How a restored backup meets the records already here.
    public enum Mode: Sendable {
        /// Everything is replaced by the backup, settings included, as on the website. A file
        /// without the Quran's or the seasons' store (the website's, say) holds none of that, so
        /// none stays.
        case replace
        /// The backup's records are added to these (see `RecordStore.merge`); settings stay.
        case merge
    }

    /// A read backup.
    public struct Contents: Hashable, Sendable {
        /// What the website would load from the file.
        public var snapshot: WebSnapshot
        /// When the file says it was exported (`backupDate`), if it says so readably.
        public var exportedAt: Date?
    }

    // MARK: Export

    /// `exportBackup`: everything, as the website writes it (indented, as the website saves the file).
    public static func export(records: RecordsSnapshot, settings: SettingsSnapshot, at now: Date = .now) -> Data {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
        return (try? encoder.encode(file(records: records, settings: settings, at: now))) ?? Data()
    }

    /// Everything in `store` and `settings`, as a backup file.
    public static func export(from store: RecordStore, settings: SettingsStore, at now: Date = .now) async throws -> Data {
        export(records: try await store.snapshot(), settings: settings.load(), at: now)
    }

    static func file(records: RecordsSnapshot, settings: SettingsSnapshot, at now: Date) -> JSONValue {
        [
            "app": "azkar",
            "version": 1,
            "exportedAt": .string(now.formatted(Date.ISO8601FormatStyle(includingFractionalSeconds: true))),
            "data": .object(WebStores.write(records: records, settings: settings)),
        ]
    }

    /// The name the website gives the file: `azkar-backup-YYYY-MM-DD.json`, the day where the user is.
    public static func fileName(at now: Date = .now, in zone: TimeZone = .current) -> String {
        "azkar-backup-\(DayKey(now, in: zone)).json"
    }

    // MARK: Import

    /// Reads a backup file as the website does: `isBackupFile`, then each store as a page load
    /// reads it. Nothing is changed; throws when the file is not a backup.
    public static func read(_ data: Data, catalog: any SessionCatalog, deviceTimeZone: String = TimeZone.current.identifier) throws -> Contents {
        guard let file = try? JSONDecoder().decode(JSONValue.self, from: data) else { throw Failure.notJSON }
        guard isBackupFile(file), let stores = file["data"]?.object else { throw Failure.notABackup }
        let entries = stores.filter { WebStores.isStoreKey($0.key) }.mapValues(StoredEntry.json)
        var snapshot = WebStores.read(entries, catalog: catalog, deviceTimeZone: deviceTimeZone)
        // What the website's import leaves out (keys no store reads) is reported, not read.
        snapshot.ignored = Set(stores.keys.filter { !WebStores.isStoreKey($0) })
        let exportedAt = file["exportedAt"]?.string.flatMap { text in
            (try? Date.ISO8601FormatStyle(includingFractionalSeconds: true).parse(text)) ?? (try? Date.ISO8601FormatStyle().parse(text))
        }
        return Contents(snapshot: snapshot, exportedAt: exportedAt)
    }

    /// `isBackupFile`.
    static func isBackupFile(_ value: JSONValue) -> Bool {
        guard value["app"] == .string("azkar"), value["version"] == .number(1), let data = value["data"]?.object else { return false }
        return data.keys.allSatisfy { $0.hasPrefix(WebStores.prefix) }
    }

    /// Restores a read backup, all or nothing: the records in one save, then the settings.
    @discardableResult
    public static func restore(_ contents: Contents, into store: RecordStore, settings: SettingsStore, mode: Mode = .replace, now: Date = .now) async throws -> ImportReport {
        let snapshot = contents.snapshot
        switch mode {
        case .replace:
            let groups = Set(SettingsStore.Group.allCases)
            let report = ImportReport(source: ImportReport.backup, at: now, snapshot: snapshot, settings: groups.map(\.rawValue).sorted())
            try await store.replaceAll(with: snapshot.records, recording: report)
            settings.save(snapshot.settings, groups: groups)
            return report
        case .merge:
            let groups = WebDataImport.settingsGroups(of: snapshot).filter { !settings.has($0) }
            let report = ImportReport(source: ImportReport.backup, at: now, snapshot: snapshot, settings: groups.map(\.rawValue).sorted())
            try await store.merge(snapshot.records, recording: report)
            if !groups.isEmpty { settings.save(snapshot.settings, groups: groups) }
            return report
        }
    }
}

extension WebStores {
    /// A key a backup is read from: those the website's import writes back (`STORE_KEYS`, plus
    /// the WIP branch's stores) and the native app's own.
    static func isStoreKey(_ key: String) -> Bool {
        stores.contains { prefix + $0 == key }
    }
}
