import AzkarCore
import Foundation

/// What the website's stores hold, read as the website reads them.
public struct WebSnapshot: Hashable, Sendable {
    public var records = RecordsSnapshot()
    public var settings = SettingsSnapshot()
    /// The stores that held something readable (names such as "prayer-log").
    public var found: Set<String> = []
    /// Keys that were present but are no store this app reads (such as "azkar:today-layout").
    public var ignored: Set<String> = []

    public init() {}
}

/// One stored value, as `localStorage.getItem` would return it.
enum StoredEntry: Sendable, Equatable {
    case missing
    /// Not JSON: the website's store throws while loading and keeps its initial state.
    case unreadable
    case json(JSONValue)

    init(_ text: String?) {
        guard let text else { self = .missing; return }
        self = JSONValue(parsing: text).map(StoredEntry.json) ?? .unreadable
    }

    var json: JSONValue? {
        if case let .json(value) = self { value } else { nil }
    }
}

/// The website's persisted stores: their keys, versions, and how zustand's `persist` loads them.
public enum WebStores {
    public static let prefix = "azkar:"
    /// The stores read and written, in the order the website creates (and so loads) them.
    /// "fasting" is the store of the website's `wip/web-seven-features` branch.
    public static let names = ["location", "settings", "prayer-times", "prayer-log", "azkar-progress", "azkar-settings", "fasting"]
    /// The WIP branch's second copy of the after-prayer and tasbih records (its `progressStorage.ts`).
    static let progressSpare = "azkar-progress-spare"
    /// The native app's own store. The website has none and its import leaves the key out, so it
    /// is written only when there is something to keep.
    static let quran = "quran"
    /// The native app's records of Ramadan and the Eids, kept the same way.
    static let seasons = "seasons"
    /// Every store read.
    static var stores: [String] { names + [progressSpare, quran, seasons] }

    /// What `persist` hands to a store's `merge` while loading.
    enum Loaded {
        /// Loading threw (stored text that is not JSON): `merge` never runs, the store keeps its initial state.
        case initial
        /// `merge(persisted)`, with `nil` for `undefined`.
        case merged(JSONValue?)

        /// `persisted` as a store's `merge` sees it; `nil` for `undefined` or loading that threw.
        var persisted: JSONValue? {
            if case let .merged(value) = self { value } else { nil }
        }
    }

    /// zustand's `hydrate`: a value stamped with another version goes through `migrate` (when the
    /// store has one; without, the store gets `undefined`), anything else hands over its `state`.
    static func load(_ entry: StoredEntry, version current: Int, migrate: ((JSONValue?, Double) -> JSONValue?)? = nil) -> Loaded {
        switch entry {
        case .missing: return .merged(nil)
        case .unreadable: return .initial
        case let .json(value):
            guard value.isTruthy else { return .merged(nil) }
            let state = value.object?["state"]
            if let version = value.object?["version"]?.number, version != Double(current) {
                guard let migrate else { return .merged(nil) }
                return .merged(migrate(state, version))
            }
            return .merged(state)
        }
    }

    /// The WIP branch's `progressStorage().getItem`: a saved state missing `afterPrayer` or `tasbih`
    /// (saved over by an older build) takes them from the spare copy.
    static func withSpare(_ progress: StoredEntry, spare: StoredEntry) -> StoredEntry {
        guard case var .json(value) = progress, var envelope = value.object, let state = envelope["state"]?.object,
              let spare = spare.json?.object else { return progress }
        var filled = state
        for field in ["afterPrayer", "tasbih"] where state[field] == nil {
            if let kept = spare[field] { filled[field] = kept }
        }
        guard filled != state else { return progress }
        envelope["state"] = .object(filled)
        value = .object(envelope)
        return .json(value)
    }

    /// Reads every store the way a page load of the website does, from `entries` keyed by full
    /// storage key ("azkar:prayer-log"). `deviceTimeZone` replaces a zone that cannot be used.
    static func read(_ entries: [String: StoredEntry], catalog: any SessionCatalog, deviceTimeZone: String) -> WebSnapshot {
        var snapshot = WebSnapshot()
        let known = Set(stores.map { prefix + $0 })
        snapshot.ignored = Set(entries.keys.filter { !known.contains($0) && $0.hasPrefix(prefix) })
        func entry(_ name: String) -> StoredEntry { entries[prefix + name] ?? .missing }
        for name in names + [quran, seasons] {
            if case let .json(value) = entry(name), value.isTruthy { snapshot.found.insert(name) }
        }

        // Location: no `migrate`, so another version's place is dropped, as on the website.
        snapshot.settings.location = load(entry("location"), version: 1).persisted.flatMap {
            SavedLocation(web: $0["location"], deviceTimeZone: deviceTimeZone)
        }
        snapshot.settings.app = AppSettings(web: load(entry("settings"), version: 1, migrate: { state, _ in AppSettings(web: state).web }).persisted)

        // Prayer times: `migrate` is `sanitizeSettings`, which turns anything into a full object; only
        // when nothing at all reaches `merge` does a saved place mean the standard Asr (`unsavedSettings`).
        let prayerTimes = load(entry("prayer-times"), version: 2, migrate: { state, _ in
            var settings = CalculationConfig(web: state).web.object ?? [:]
            settings.merge(ReminderSettings(web: state).web.object ?? [:]) { _, reminder in reminder }
            return .object(settings)
        })
        switch prayerTimes {
        case .initial: break
        case .merged(nil), .merged(.null):
            if snapshot.settings.location != nil { snapshot.settings.calculation = .unsavedWithPlace }
        case let .merged(persisted):
            snapshot.settings.calculation = CalculationConfig(web: persisted)
            snapshot.settings.reminders = ReminderSettings(web: persisted)
        }

        snapshot.records.prayers = WebPrayerLog.read(load(entry("prayer-log"), version: WebPrayerLog.version, migrate: { state, _ in
            WebPrayerLog.web(WebPrayerLog.read(state))
        }).persisted)

        let progress = load(withSpare(entry("azkar-progress"), spare: entry(progressSpare)), version: 2, migrate: { state, version in
            WebProgress(web: state, version: version, catalog: catalog).web
        })
        if let persisted = progress.persisted {
            let read = WebProgress(web: persisted, version: nil, catalog: catalog)
            snapshot.records.counts = read.counts
            snapshot.records.sessions = read.sessions
            snapshot.records.totals = read.totals
            snapshot.records.tasbih = read.tasbih
        }

        snapshot.settings.reader = ReaderSettings(web: load(entry("azkar-settings"), version: 1, migrate: { state, _ in
            ReaderSettings(web: state).web
        }).persisted)

        let fasting = WebFasting.read(load(entry("fasting"), version: WebFasting.version, migrate: { state, _ in
            let read = WebFasting.read(state)
            return WebFasting.web(read.fasts, owedBefore: read.owedBefore)
        }).persisted)
        snapshot.records.fasts = fasting.fasts
        snapshot.records.owedFastsBefore = fasting.owedBefore

        let reading = WebQuran.read(load(entry(quran), version: WebQuran.version, migrate: { state, _ in
            let read = WebQuran.read(state)
            return WebQuran.web(read.entries, bookmarks: read.bookmarks)
        }).persisted)
        snapshot.records.quran = reading.entries
        snapshot.records.quranBookmarks = reading.bookmarks

        snapshot.records.seasons = WebSeasons.read(load(entry(seasons), version: WebSeasons.version, migrate: { state, _ in
            WebSeasons.web(WebSeasons.read(state))
        }).persisted)
        return snapshot
    }

    /// Each store's saved value (`{ state, version }`) by full storage key, as the website writes them.
    static func write(records: RecordsSnapshot, settings: SettingsSnapshot) -> [String: JSONValue] {
        var progress = WebProgress()
        progress.counts = records.counts
        progress.sessions = records.sessions
        progress.totals = records.totals
        progress.tasbih = records.tasbih
        var prayerTimes = settings.calculation.web.object ?? [:]
        prayerTimes.merge(settings.reminders.web.object ?? [:]) { _, reminder in reminder }

        func stored(_ state: JSONValue, _ version: Int) -> JSONValue { ["state": state, "version": JSONValue(version)] }
        var stores: [String: JSONValue] = [
            prefix + "location": stored(["location": settings.location?.web ?? .null], 1),
            prefix + "settings": stored(settings.app.web, 1),
            // 3: the WIP branch's version, with `unloggedReminders`; the main branch migrates it field by field.
            prefix + "prayer-times": stored(.object(prayerTimes), 3),
            prefix + "prayer-log": stored(WebPrayerLog.web(records.prayers), WebPrayerLog.version),
            // 3: the WIP branch's version; the main branch reads its version 2 fields and leaves the rest.
            prefix + "azkar-progress": stored(progress.web, WebProgress.version),
            prefix + "azkar-settings": stored(settings.reader.web, 1),
            prefix + "fasting": stored(WebFasting.web(records.fasts, owedBefore: records.owedFastsBefore), WebFasting.version),
        ]
        if !records.quran.isEmpty || !records.quranBookmarks.isEmpty {
            stores[prefix + quran] = stored(WebQuran.web(records.quran, bookmarks: records.quranBookmarks), WebQuran.version)
        }
        if records.seasons.values.contains(where: { !$0.isEmpty }) {
            stores[prefix + seasons] = stored(WebSeasons.web(records.seasons), WebSeasons.version)
        }
        return stores
    }
}
