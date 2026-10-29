import AzkarCore
import Foundation

/// The one-time import of what the web-based app (the Capacitor build with the same bundle id)
/// kept on the phone.
///
/// That app mirrored each of its `localStorage` keys into the app's standard `UserDefaults`
/// through `@capacitor/preferences` (src/native/durableStorage.ts): the key
/// "CapacitorStorage.azkar:<store>", the value the store's persisted JSON text. Those values
/// are read exactly as a page load of the website reads them (`WebStores`), every version
/// included, and merged into the records; settings are taken for each group the app has not
/// set yet. The source keys are never touched. The import is recorded with the records, in the
/// same save, so it runs once however often it is called.
public enum WebDataImport {
    /// `@capacitor/preferences`' default group, and so its key prefix.
    public static let keyPrefix = "CapacitorStorage."

    /// The web-based app's stored values in `defaults`, by `localStorage` key ("azkar:prayer-log").
    static func entries(in defaults: UserDefaults) -> [String: StoredEntry] {
        var entries: [String: StoredEntry] = [:]
        for (key, value) in defaults.dictionaryRepresentation() where key.hasPrefix(keyPrefix + WebStores.prefix) {
            let name = String(key.dropFirst(keyPrefix.count))
            entries[name] = (value as? String).map(StoredEntry.init) ?? .unreadable
        }
        return entries
    }

    /// Imports the web-based app's data unless that was done before. Returns what was imported
    /// (the earlier report when it ran before).
    @discardableResult
    public static func runIfNeeded(from defaults: UserDefaults = .standard, into store: RecordStore, settings: SettingsStore,
                                   deviceTimeZone: String = TimeZone.current.identifier, now: Date = .now) async throws -> ImportReport {
        if let earlier = try await earlierReport(store) { return earlier }
        let snapshot = WebStores.read(entries(in: defaults), catalog: store.catalog, deviceTimeZone: deviceTimeZone)

        // Settings first: if the records then fail, the next launch tries again and finds these set.
        let groups = settingsGroups(of: snapshot).filter { !settings.has($0) }
        if !groups.isEmpty { settings.save(snapshot.settings, groups: groups) }

        let report = ImportReport(source: ImportReport.webApp, at: now, snapshot: snapshot, settings: groups.map(\.rawValue).sorted())
        guard try await store.merge(snapshot.records, recording: report, once: true) else {
            return try await earlierReport(store) ?? report
        }
        return report
    }

    /// The settings groups the website had something stored for.
    static func settingsGroups(of snapshot: WebSnapshot) -> Set<SettingsStore.Group> {
        var groups: Set<SettingsStore.Group> = []
        if snapshot.found.contains("settings") { groups.insert(.app) }
        if snapshot.settings.location != nil { groups.insert(.location) }
        // A place without saved calculation settings keeps the standard Asr (`unsavedSettings`).
        if snapshot.found.contains("prayer-times") || snapshot.settings.location != nil { groups.insert(.calculation) }
        if snapshot.found.contains("prayer-times") { groups.insert(.reminders) }
        if snapshot.found.contains("azkar-settings") { groups.insert(.reader) }
        return groups
    }

    private static func earlierReport(_ store: RecordStore) async throws -> ImportReport? {
        guard try await store.hasImported(ImportReport.webApp) else { return nil }
        return try await store.importReports().last { $0.source == ImportReport.webApp }
    }
}
