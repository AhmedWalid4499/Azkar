import AzkarKit
import Foundation
import Observation
import UIKit
import UserNotifications
import WidgetKit

/// The parts of the app that run with the system: reminders (local notifications), adhan alarms,
/// background refresh, the "Next prayer" Live Activity and widget reloads.
///
/// `run(_:)`, which the root view calls once, keeps all of them in step with the user's records and
/// settings for as long as the app runs: at launch, on coming to the foreground, whenever a record
/// or a setting is saved (by the app, a widget, a control or Siri), when the clock or zone changes,
/// and in a background refresh every few hours. `SystemAppDelegate` sets up what must exist before
/// launch ends (the notification delegate, the background task).
///
/// For screens: `permissions` (notification and alarm permission, with `requestNotifications()` /
/// `requestAlarms()`), `liveActivity` (`isOn`, `isRunning`, `isAllowed`) with `setLiveActivity(_:)`.
@MainActor
@Observable
final class SystemServices {
    static let shared = SystemServices()

    let permissions = SystemPermissions()
    let liveActivity = NextPrayerActivity()

    @ObservationIgnored private var app: AppEnvironment?
    @ObservationIgnored private let responder = NotificationResponder()
    @ObservationIgnored private var launched = false
    @ObservationIgnored private var refreshing = false
    @ObservationIgnored private var refreshAgain = false
    @ObservationIgnored private var lastSettings: SettingsSnapshot?
    @ObservationIgnored private var categoriesLanguage: SystemLanguage?
    @ObservationIgnored private var nextChange: Task<Void, Never>?
    @ObservationIgnored private var pendingRefresh: Task<Void, Never>?

    private init() {}

    /// What must be in place before the app finishes launching, so a "Prayed ✓" that launches the
    /// app in the background is answered. Safe to call again.
    func launch() {
        guard !launched else { return }
        launched = true
        UNUserNotificationCenter.current().delegate = responder
        registerCategories(SystemLanguage(SharedRecords.settings.load().app))
        WatchBridge.shared.activate()
    }

    /// Starts everything and keeps it in step with the user's records and settings for as long as the app runs.
    func run(_ app: AppEnvironment) async {
        self.app = app
        SharedRecords.use(app.store)
        launch()
        lastSettings = app.settings.settings

        await withDiscardingTaskGroup { group in
            group.addTask { await self.start(app) }
            group.addTask { await self.follow(.records) }
            group.addTask { await self.follow(.settings) }
            group.addTask { await self.followForeground() }
            group.addTask { await self.followClock() }
            group.addTask { await self.liveActivity.follow() }
            group.addTask { await self.permissions.followAlarms() }
        }
    }

    /// The first refresh, once the followers are listening (the web import may save while it runs).
    private func start(_ app: AppEnvironment) async {
        await Task.yield()
        await permissions.refresh()
        askForMissingPermissions(app.settings.settings)
        await refresh(reason: "launch", reloadWidgets: true)
        #if DEBUG
        await SystemDebug.runLaunchArguments(app)
        #endif
    }

    // MARK: Live Activity

    /// Turns the "Next prayer" Live Activity on or off (from Today). Starting needs the app in the foreground.
    func setLiveActivity(_ on: Bool) async {
        if on {
            let (settings, board) = await currentBoard()
            await liveActivity.start(settings: settings, board: board)
        } else {
            await liveActivity.stop()
        }
    }

    // MARK: Refreshing

    /// Brings reminders, alarms, the Live Activity and (when asked) the widgets up to date with what
    /// is saved now. Calls made while one runs are folded into one more.
    func refresh(reason: String, reloadWidgets: Bool = false) async {
        if reloadWidgets { WidgetCenter.shared.reloadAllTimelines() }
        if refreshing {
            refreshAgain = true
            return
        }
        refreshing = true
        defer { refreshing = false }
        repeat {
            refreshAgain = false
            await refreshOnce()
        } while refreshAgain
        await BackgroundRefresh.schedule()
    }

    private func refreshOnce() async {
        let now = Date.now
        let settings = SharedRecords.settings.load()
        let language = SystemLanguage(settings.app)
        if categoriesLanguage != language { registerCategories(language) }

        let logged = await loggedPrayers(around: now, timeZone: settings.timeZone)
        await ReminderScheduler.reschedule(settings: settings, logged: logged, now: now)
        if Self.alarmLanguage != language.code {
            AdhanAlarms.cancelAll()
            Self.alarmLanguage = language.code
        }
        await AdhanAlarms.reschedule(settings: settings, now: now)

        let (_, board) = await currentBoard(settings: settings, now: now)
        let active = UIApplication.shared.applicationState == .active
        await liveActivity.update(settings: settings, board: board, canStart: active)
        await WatchBridge.shared.push(settings: settings, board: board)
        scheduleNextChange(board)
    }

    /// The board now, from the stores.
    func currentBoard(settings: SettingsSnapshot? = nil, now: Date = .now) async -> (SettingsSnapshot, SystemPrayerBoard?) {
        let settings = settings ?? SharedRecords.settings.load()
        let prayers = (try? await SharedRecords.store().prayersAround(now, in: settings.timeZone)) ?? [:]
        return (settings, SystemPrayerBoard(settings: settings, prayers: prayers, now: now))
    }

    /// The prayers logged from yesterday to the end of the reminder window, any status.
    private func loggedPrayers(around now: Date, timeZone: TimeZone) async -> [DayKey: Set<Prayer>] {
        guard let store = try? SharedRecords.store(),
              let days = try? await store.prayersAround(now, in: timeZone, back: 2, ahead: ReminderPlan.windowDays + 2) else { return [:] }
        return days.mapValues { Set($0.prayers.keys) }
    }

    /// While the app runs, moves the Live Activity on when the next prayer comes.
    private func scheduleNextChange(_ board: SystemPrayerBoard?) {
        nextChange?.cancel()
        guard let next = board?.next else { return }
        let delay = max(1, next.at.timeIntervalSinceNow + 1)
        nextChange = Task { [weak self] in
            try? await Task.sleep(for: .seconds(delay))
            guard !Task.isCancelled else { return }
            await self?.refresh(reason: "prayer time", reloadWidgets: true)
        }
    }

    // MARK: Following changes

    private func follow(_ change: StoreChange) async {
        for await _ in StoreNotifications.changes(change) {
            if change == .settings { await settingsChanged() }
            refreshSoon(reason: "\(change) changed")
        }
    }

    /// One refresh for a burst of changes (counting azkar saves at every tap).
    private func refreshSoon(reason: String) {
        pendingRefresh?.cancel()
        pendingRefresh = Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(700))
            guard !Task.isCancelled else { return }
            await self?.refresh(reason: reason, reloadWidgets: true)
        }
    }

    /// Asks for permission the first time a reminder switch or an adhan is turned on, or a place is
    /// first saved with reminders on (the "not logged yet" reminders are on from the start).
    private func settingsChanged() async {
        let settings = SharedRecords.settings.load()
        defer { lastSettings = settings }
        guard let before = lastSettings, UIApplication.shared.applicationState == .active else { return }
        let was = before.reminders, now = settings.reminders
        let switchedOn = (!was.prayers && now.prayers) || (!was.unlogged && now.unlogged)
            || (!was.morningAzkar && now.morningAzkar) || (!was.eveningAzkar && now.eveningAzkar)
        let placeArrived = before.location == nil && settings.location != nil && ReminderScheduler.wantsNotifications(now)
        // The alerts wait for the user; following changes must not.
        if switchedOn || placeArrived {
            Task {
                if await permissions.requestNotifications() { await refresh(reason: "notifications allowed") }
            }
        }
        if !now.adhan.isSubset(of: was.adhan) {
            Task {
                if await permissions.requestAlarms() { await refresh(reason: "alarms allowed") }
            }
        }
    }

    /// Settings that arrived already on (the web app's data, a restored backup) but were never asked
    /// for: ask once, when a place is saved so the reminders mean something.
    func askForMissingPermissions(_ settings: SettingsSnapshot) {
        guard settings.location != nil else { return }
        if permissions.notifications == .notDetermined, ReminderScheduler.wantsNotifications(settings.reminders) {
            Task {
                if await permissions.requestNotifications() { await refresh(reason: "notifications allowed") }
            }
        }
        if permissions.alarms == .notDetermined, !settings.reminders.adhan.isEmpty {
            Task {
                if await permissions.requestAlarms() { await refresh(reason: "alarms allowed") }
            }
        }
    }

    private func followForeground() async {
        for await _ in NotificationCenter.default.notifications(named: UIApplication.didBecomeActiveNotification).map({ _ in () }) {
            await permissions.refresh()
            await refresh(reason: "foreground", reloadWidgets: false)
        }
    }

    private func followClock() async {
        let names: [Notification.Name] = [UIApplication.significantTimeChangeNotification, .NSSystemTimeZoneDidChange]
        await withDiscardingTaskGroup { group in
            for name in names {
                group.addTask {
                    for await _ in NotificationCenter.default.notifications(named: name).map({ _ in () }) {
                        await self.refresh(reason: "clock changed", reloadWidgets: true)
                    }
                }
            }
        }
    }

    private func registerCategories(_ language: SystemLanguage) {
        categoriesLanguage = language
        UNUserNotificationCenter.current().setNotificationCategories(NotificationCategories.all(language))
    }

    /// The language the adhan alarms were last set in (their titles are fixed when set).
    private static var alarmLanguage: String? {
        get { UserDefaults.standard.string(forKey: "system.alarms.language") }
        set { UserDefaults.standard.set(newValue, forKey: "system.alarms.language") }
    }
}
