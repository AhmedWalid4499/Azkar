import AzkarCore
import Foundation

/// The settings on the device: the App Group's `UserDefaults`, so the widgets and App Intents
/// read what the app sets.
///
/// Each group is kept under its own key as the JSON the website saves for it, and read back
/// through the website's validation, field by field: a value written by a later version, or
/// damaged, costs only that field. New fields need no migration; they read as their default.
/// Writes post `StoreChange.settings`.
public struct SettingsStore: @unchecked Sendable {
    // `UserDefaults` is thread-safe; it is not marked `Sendable` on every SDK.
    public let defaults: UserDefaults
    /// False when the App Group was unavailable and the app's own defaults are used.
    public let isShared: Bool
    private let postsNotifications: Bool

    /// The settings groups, by the key each is kept under.
    public enum Group: String, CaseIterable, Sendable {
        case app, location, calculation, reminders, reader

        var key: String { "settings.\(rawValue)" }
    }

    public init(defaults: UserDefaults, isShared: Bool = false, postsNotifications: Bool = true) {
        self.defaults = defaults
        self.isShared = isShared
        self.postsNotifications = postsNotifications
    }

    /// The App Group's defaults, or the app's own when the group is not available.
    public static func shared() -> SettingsStore {
        if FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: StoreContainer.appGroup) != nil,
           let group = UserDefaults(suiteName: StoreContainer.appGroup) {
            return SettingsStore(defaults: group, isShared: true)
        }
        return SettingsStore(defaults: .standard, isShared: false)
    }

    // MARK: Reading

    public func load() -> SettingsSnapshot {
        SettingsSnapshot(
            app: AppSettings(web: json(.app)),
            location: location(),
            calculation: CalculationConfig(web: json(.calculation)),
            reminders: ReminderSettings(web: json(.reminders)),
            reader: ReaderSettings(web: json(.reader))
        )
    }

    public func location() -> SavedLocation? {
        SavedLocation(web: json(.location), deviceTimeZone: TimeZone.current.identifier)
    }

    /// The zone "today" is in: the saved place's, else the device's. Pass `{ settings.timeZone() }`
    /// to `RecordStore` so a day not yet begun where the user is cannot be logged.
    public func timeZone() -> TimeZone {
        location()?.zone ?? .current
    }

    /// Whether anything is stored for `group`.
    public func has(_ group: Group) -> Bool {
        defaults.object(forKey: group.key) != nil
    }

    private func json(_ group: Group) -> JSONValue? {
        guard let data = defaults.data(forKey: group.key) else { return nil }
        return try? JSONDecoder().decode(JSONValue.self, from: data)
    }

    // MARK: Writing

    /// Saves every group of `snapshot`, made valid. Returns what was saved.
    @discardableResult
    public func save(_ snapshot: SettingsSnapshot) -> SettingsSnapshot {
        save(snapshot, groups: Set(Group.allCases))
    }

    /// Saves the groups named of `snapshot`, made valid; the rest stay as they are.
    @discardableResult
    public func save(_ snapshot: SettingsSnapshot, groups: Set<Group>) -> SettingsSnapshot {
        let clean = snapshot.sanitized()
        for group in Group.allCases where groups.contains(group) {
            switch group {
            case .app: write(clean.app.web, group)
            case .location: write(clean.location?.web, group)
            case .calculation: write(clean.calculation.web, group)
            case .reminders: write(clean.reminders.web, group)
            case .reader: write(clean.reader.web, group)
            }
        }
        if postsNotifications { StoreNotifications.post(.settings) }
        return load()
    }

    /// Reads, changes and saves the settings; only the groups that changed are written.
    @discardableResult
    public func update(_ change: (inout SettingsSnapshot) -> Void) -> SettingsSnapshot {
        let before = load()
        var after = before
        change(&after)
        let changed = Set(Group.allCases.filter { before.value(of: $0) != after.value(of: $0) })
        return changed.isEmpty ? before : save(after, groups: changed)
    }

    private func write(_ value: JSONValue?, _ group: Group) {
        guard let value else {
            defaults.removeObject(forKey: group.key)
            return
        }
        defaults.set(Data(value.text.utf8), forKey: group.key)
    }
}

extension SettingsSnapshot {
    /// One group, as stored, to tell what changed.
    func value(of group: SettingsStore.Group) -> JSONValue {
        switch group {
        case .app: app.web
        case .location: location?.web ?? .null
        case .calculation: calculation.web
        case .reminders: reminders.web
        case .reader: reader.web
        }
    }
}
