import AzkarCore
import Foundation

/// Every reminder the app can give. The website keeps these in its prayer-times store
/// (`src/features/prayer-times/config.ts`): `notifications`, `azkarReminders`, and on its
/// `wip/web-seven-features` branch `unloggedReminders`. The adhan alarms are the native app's own.
public struct ReminderSettings: Hashable, Sendable {
    /// How long before a prayer's time ends its "not logged yet" reminder can come.
    public static let unloggedLeadChoices = [10, 15, 30, 45, 60]
    public static let `default` = ReminderSettings()

    /// A notification at each of the five prayer times (the website's `notifications`).
    public var prayers = false
    /// A reminder shortly before each prayer's time ends while it is not logged. On by default.
    public var unlogged = true
    /// Minutes before the end of the prayer's time; one of `unloggedLeadChoices`.
    public var unloggedLeadMinutes = 15
    /// Where Isha's time is taken to end for its reminder.
    public var ishaDeadline: IshaDeadline = .middle
    public var morningAzkar = false
    public var eveningAzkar = false
    /// When the morning azkar reminder comes.
    public var morningAt: MorningReminderTime = .fajr
    /// The prayers whose time sounds the adhan as an alarm.
    public var adhan: Set<Prayer> = []

    public init() {}

    /// The same settings made valid (a lead time not on offer goes back to the default).
    public func sanitized() -> ReminderSettings { ReminderSettings(web: web) }
}

extension ReminderSettings {
    /// Reads the reminder fields of the website's prayer-times state, as its `sanitizeSettings` does.
    public init(web value: JSONValue?) {
        self.init()
        let stored = value?.object ?? [:]
        prayers = stored["notifications"] == .bool(true)
        let azkar = stored["azkarReminders"]?.object ?? [:]
        morningAzkar = azkar["morning"] == .bool(true)
        eveningAzkar = azkar["evening"] == .bool(true)
        morningAt = azkar["morningAt"] == .string("sunrise") ? .sunrise : .fajr
        let unloggedStored = stored["unloggedReminders"]?.object ?? [:]
        if let enabled = unloggedStored["enabled"]?.bool { unlogged = enabled }
        if let lead = unloggedStored["leadMinutes"]?.number, WebRules.isInteger(lead), Self.unloggedLeadChoices.contains(Int(lead)) {
            unloggedLeadMinutes = Int(lead)
        }
        if let raw = unloggedStored["ishaEnds"]?.string, let deadline = IshaDeadline(rawValue: raw) { ishaDeadline = deadline }
        let alarms = stored["adhanAlarms"]?.object ?? [:]
        adhan = Set(Prayer.allCases.filter { alarms[$0.rawValue] == .bool(true) })
    }

    /// The reminder fields of the website's prayer-times state.
    public var web: JSONValue {
        [
            "notifications": .bool(prayers),
            "azkarReminders": ["morning": .bool(morningAzkar), "evening": .bool(eveningAzkar), "morningAt": .string(morningAt.rawValue)],
            "unloggedReminders": ["enabled": .bool(unlogged), "leadMinutes": JSONValue(unloggedLeadMinutes), "ishaEnds": .string(ishaDeadline.rawValue)],
            "adhanAlarms": .object(Dictionary(uniqueKeysWithValues: Prayer.allCases.map { ($0.rawValue, JSONValue.bool(adhan.contains($0))) })),
        ]
    }
}

extension ReminderSettings: Codable {
    public init(from decoder: Decoder) throws { self.init(web: try JSONValue(from: decoder)) }
    public func encode(to encoder: Encoder) throws { try web.encode(to: encoder) }
}
