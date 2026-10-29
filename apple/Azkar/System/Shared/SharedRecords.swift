import AzkarKit
import Foundation
import UserNotifications
import WidgetKit

/// The stores as every process of the app reaches them: the App Group's settings and records.
/// The app hands over its own record store (`use(_:)`) so one process never opens two; a widget,
/// a control or an App Intent opens the shared one on first use.
///
/// Shared by the app and the widget extension.
nonisolated enum SharedRecords {
    private static let lock = NSLock()
    nonisolated(unsafe) private static var opened: RecordStore?

    static var settings: SettingsStore { SettingsStore.shared() }

    /// Uses the app's store from now on.
    static func use(_ store: RecordStore) {
        lock.withLock { opened = store }
    }

    /// The record store, opened when first needed.
    static func store() throws -> RecordStore {
        try lock.withLock {
            if let opened { return opened }
            let settings = SettingsStore.shared()
            let store = try RecordStore.open(.shared, catalog: StaticSessionCatalog.empty, timeZone: { settings.timeZone() })
            opened = store
            return store
        }
    }

    /// The settings, and the prayer board at `now` with what is logged.
    static func board(at now: Date = .now) async -> (SettingsSnapshot, SystemPrayerBoard?) {
        let settings = settings.load()
        guard let store = try? store(),
              let prayers = try? await store.prayersAround(now, in: settings.timeZone) else {
            return (settings, SystemPrayerBoard(settings: settings, prayers: [:], now: now))
        }
        return (settings, SystemPrayerBoard(settings: settings, prayers: prayers, now: now))
    }
}

/// Logging a prayer from anywhere outside the app's screens (a notification action, a widget,
/// a control, Siri): through the record store, then the reminders that no longer apply are taken
/// back and the widgets redrawn. The app's own reminders are fully rescheduled when it next runs.
nonisolated enum PrayerLogging {
    enum Outcome: Sendable, Equatable {
        case logged
        /// It was logged already (a widget tap or "Prayed" never overwrites a status).
        case alreadyLogged
        /// The day has not begun where the user is.
        case refused
    }

    /// Prayed on time, unless it is logged already.
    @discardableResult
    static func tick(_ prayer: Prayer, on day: DayKey) async throws -> Outcome {
        let change = try await SharedRecords.store().logPrayer(prayer, on: day)
        return await finish(change.result, prayer, day)
    }

    /// Sets a status, replacing any.
    @discardableResult
    static func set(_ prayer: Prayer, _ status: PrayerStatus, on day: DayKey) async throws -> Outcome {
        let change = try await SharedRecords.store().setPrayer(prayer, status, on: day)
        return await finish(change.result, prayer, day)
    }

    private static func finish(_ result: ChangeResult, _ prayer: Prayer, _ day: DayKey) async -> Outcome {
        switch result {
        case .refusedFutureDay: return .refused
        case .unchanged:
            await withdrawReminders(of: prayer, on: day)
            return .alreadyLogged
        case .changed:
            await withdrawReminders(of: prayer, on: day)
            WidgetCenter.shared.reloadAllTimelines()
            return .logged
        }
    }

    /// Cancels the prayer's pending "not logged yet" reminder and clears its delivered reminders.
    static func withdrawReminders(of prayer: Prayer, on day: DayKey) async {
        let center = UNUserNotificationCenter.current()
        let unlogged = String(ReminderPlan.unloggedReminderID(day: day, prayer: prayer))
        center.removePendingNotificationRequests(withIdentifiers: [unlogged])
        let delivered = await center.deliveredNotifications()
        let stale = delivered.filter { note in
            let info = ReminderInfo(note.request.content.userInfo)
            return info?.prayer == prayer && info?.day == day && info?.kind != .azkar
        }
        center.removeDeliveredNotifications(withIdentifiers: stale.map(\.request.identifier) + [unlogged])
    }
}

/// What a reminder notification carries, so a tap or an action knows what it is about.
nonisolated struct ReminderInfo: Equatable, Sendable {
    enum Kind: String, Sendable {
        case prayer, unlogged, azkar
    }

    static let marker = "azkar.reminder"

    var kind: Kind
    var day: DayKey
    var prayer: Prayer?
    var session: AzkarSession?

    init(kind: Kind, day: DayKey, prayer: Prayer? = nil, session: AzkarSession? = nil) {
        self.kind = kind
        self.day = day
        self.prayer = prayer
        self.session = session
    }

    init?(_ userInfo: [AnyHashable: Any]) {
        guard let kind = (userInfo[Self.marker] as? String).flatMap(Kind.init(rawValue:)),
              let day = (userInfo["day"] as? String).flatMap(DayKey.init) else { return nil }
        self.kind = kind
        self.day = day
        prayer = (userInfo["prayer"] as? String).flatMap(Prayer.init(rawValue:))
        session = (userInfo["session"] as? String).flatMap(AzkarSession.init)
    }

    var userInfo: [String: String] {
        var info = [Self.marker: kind.rawValue, "day": day.description]
        if let prayer { info["prayer"] = prayer.rawValue }
        if let session { info["session"] = session.description }
        return info
    }
}
