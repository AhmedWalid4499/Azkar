#if DEBUG
import AlarmKit
import AppIntents
import AzkarKit
import Foundation
import UserNotifications

/// Debug-build launch arguments for trying the system features in the simulator:
///
/// - `-SystemDebugProvisional` asks for provisional (quiet) notifications, which need no alert.
/// - `-SystemDebugSeed` saves Riyadh as the place, turns every reminder on with an adhan at Maghrib,
///   names the user and logs Fajr, all through the app's own models.
/// - `-SystemDebugLanguage ar|en` sets the in-app language.
/// - `-SystemDebugTestReminder <seconds>` adds a reminder for the latest prayer, due in that many seconds,
///   with the real category and actions ("Prayed ✓" logs it); `-SystemDebugTestPrayer dhuhr` picks today's prayer.
/// - `-SystemDebugAnswerPrayed` waits for that reminder to be delivered and answers it with "Prayed ✓".
/// - `-SystemDebugLiveActivity` starts the Live Activity.
/// - `-SystemDebugIntent log-current|next|log:asr:jamaah|tick:asr|open-qibla|open:morning` runs an intent's `perform()`.
/// - `-SystemDebugDump` prints the pending reminders, the adhan alarms and the Live Activity (also after each of the above).
enum SystemDebug {
    static func runLaunchArguments(_ app: AppEnvironment) async {
        let defaults = UserDefaults.standard
        var acted = false
        if defaults.bool(forKey: "SystemDebugProvisional") {
            // Quiet notifications without the permission alert, for unattended runs.
            _ = try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .provisional])
            await SystemServices.shared.permissions.refresh()
        }
        if defaults.bool(forKey: "SystemDebugAskAlarms") {
            try? await Task.sleep(for: .seconds(3))
            print("SystemDebug: alarm permission asked, allowed \(await SystemServices.shared.permissions.requestAlarms())")
        }
        if defaults.bool(forKey: "SystemDebugSeed") {
            await seed(app)
            acted = true
        }
        if let code = defaults.string(forKey: "SystemDebugLanguage") {
            app.settings.update { $0.app.language = code == "ar" ? .ar : .en }
            acted = true
        }
        if defaults.object(forKey: "SystemDebugTestReminder") != nil {
            await testReminder(in: max(1, defaults.double(forKey: "SystemDebugTestReminder")))
            acted = true
        }
        if defaults.bool(forKey: "SystemDebugAnswerPrayed") {
            await answerDeliveredWithPrayed()
            acted = true
        }
        if defaults.bool(forKey: "SystemDebugLiveActivity") {
            await SystemServices.shared.setLiveActivity(true)
            acted = true
        }
        if let intent = defaults.string(forKey: "SystemDebugIntent") {
            await run(intent: intent)
            acted = true
        }
        if defaults.bool(forKey: "SystemDebugRender") {
            await SystemDebugRender.run()
        }
        if acted || defaults.bool(forKey: "SystemDebugDump") {
            await SystemServices.shared.refresh(reason: "debug", reloadWidgets: true)
            await dump()
        }
    }

    static func seed(_ app: AppEnvironment) async {
        app.settings.update { settings in
            settings.location = SavedLocation(
                latitude: 24.7136, longitude: 46.6753, timeZone: "Asia/Riyadh", label: "Riyadh", countryCode: "SA",
                source: .manual, updatedAt: Date.now.timeIntervalSince1970 * 1000
            )
            settings.reminders.prayers = true
            settings.reminders.unlogged = true
            settings.reminders.morningAzkar = true
            settings.reminders.eveningAzkar = true
            settings.reminders.adhan = [.maghrib]
            settings.app.name = "Ahmed"
        }
        let today = DayKey(.now, in: app.settings.settings.timeZone)
        _ = try? await app.records.logPrayer(.fajr, on: today)
        SystemServices.shared.askForMissingPermissions(app.settings.settings)
        print("SystemDebug: seeded Riyadh, every reminder, adhan at Maghrib, Fajr logged on \(today)")
    }

    static func testReminder(in seconds: TimeInterval) async {
        let (settings, board) = await SystemServices.shared.currentBoard()
        guard let board, let location = settings.location else { return print("SystemDebug: no place saved") }
        let chosen = UserDefaults.standard.string(forKey: "SystemDebugTestPrayer").flatMap(Prayer.init(rawValue:))
        let today = chosen.flatMap { prayer in board.timeline.entries.first { $0.prayer == prayer && $0.day == board.today } }
        let latest = today ?? board.latestUnlogged ?? board.previous ?? board.next
        guard let latest else { return }
        var withPrayers = settings
        withPrayers.reminders.prayers = true
        let planned = ReminderScheduler.plan(settings: withPrayers, logged: [:], now: latest.at.addingTimeInterval(-1))
        guard let entry = planned.first(where: { $0.kind == .prayer(latest.prayer) && $0.day == latest.day }) else { return }
        let context = ReminderContent.Context(language: SystemLanguage(settings.app), timeZone: location.zone, place: location.label, name: settings.app.name)
        let content = ReminderContent.make(entry, context)
        let request = UNNotificationRequest(identifier: "debug.test", content: content, trigger: UNTimeIntervalNotificationTrigger(timeInterval: seconds, repeats: false))
        do {
            try await UNUserNotificationCenter.current().add(request)
            print("SystemDebug: test reminder for \(latest.prayer) of \(latest.day) in \(Int(seconds)) s")
        } catch {
            print("SystemDebug: test reminder failed: \(error)")
        }
    }

    /// Waits for the test reminder to be delivered, then answers it with "Prayed ✓" through the
    /// same path a real response takes.
    static func answerDeliveredWithPrayed() async {
        let center = UNUserNotificationCenter.current()
        for _ in 0..<30 {
            let delivered = await center.deliveredNotifications()
            if let note = delivered.first(where: { ReminderInfo($0.request.content.userInfo)?.prayer != nil }),
               let info = ReminderInfo(note.request.content.userInfo) {
                print("SystemDebug: delivered “\(note.request.content.title)” (\(note.request.identifier)); answering Prayed ✓")
                let unlogged = String(ReminderPlan.unloggedReminderID(day: info.day, prayer: info.prayer!))
                let before = await center.pendingNotificationRequests().contains { $0.identifier == unlogged }
                await SystemServices.shared.handle(NotificationResponder.Response(info: info, action: NotificationCategories.prayedAction))
                let after = await center.pendingNotificationRequests().contains { $0.identifier == unlogged }
                let (_, board) = await SystemServices.shared.currentBoard()
                let status = board?.status(of: info.prayer!, on: info.day)
                print("SystemDebug: \(info.prayer!) of \(info.day) is now \(status?.rawValue ?? "not logged"); its unlogged reminder \(unlogged) pending before \(before), after \(after)")
                return
            }
            try? await Task.sleep(for: .seconds(1))
        }
        print("SystemDebug: no reminder was delivered")
    }

    static func run(intent name: String) async {
        let parts = name.split(separator: ":").map(String.init)
        do {
            switch parts.first {
            case "log-current": _ = try await LogCurrentPrayerIntent().perform()
            case "next": _ = try await NextPrayerIntent().perform()
            case "log":
                guard parts.count == 3, let prayer = PrayerChoice(rawValue: parts[1]), let status = PrayerStatusChoice(rawValue: parts[2]) else { return }
                _ = try await LogPrayerIntent(prayer: prayer, status: status).perform()
            case "tick":
                guard parts.count == 2, let prayer = Prayer(rawValue: parts[1]) else { return }
                let (_, board) = await SystemServices.shared.currentBoard()
                _ = try await TickPrayerIntent(prayer: prayer, day: board?.today ?? DayKey(.now, in: .current)).perform()
            case "open-qibla": _ = try await OpenQiblaIntent().perform()
            case "open":
                guard parts.count == 2, let session = SessionChoice(rawValue: parts[1]) else { return }
                _ = try await OpenAzkarSessionIntent(session: session).perform()
            default: return print("SystemDebug: unknown intent \(name)")
            }
            let (settings, board) = await SystemServices.shared.currentBoard()
            print("SystemDebug: ran \(name); route \(String(describing: SystemRouter.shared.pending)); today \(board?.rows.map { "\($0.prayer)=\($0.status?.rawValue ?? "-")" } ?? []); yesterday \(board.map { board in Prayer.allCases.map { "\($0)=\(board.status(of: $0, on: board.today.adding(days: -1))?.rawValue ?? "-")" } } ?? [])")
            if parts.first == "next", let board, let next = board.next {
                print("SystemDebug: next says “\(IntentReply.next(next, board: board, SystemLanguage(settings.app)))”")
            }
        } catch {
            print("SystemDebug: intent \(name) failed: \(error)")
        }
    }

    static func dump() async {
        let center = UNUserNotificationCenter.current()
        let pending = await center.pendingNotificationRequests().sorted { lhs, rhs in
            let a = (lhs.trigger as? UNCalendarNotificationTrigger)?.nextTriggerDate() ?? .distantFuture
            let b = (rhs.trigger as? UNCalendarNotificationTrigger)?.nextTriggerDate() ?? .distantFuture
            return a < b
        }
        print("SystemDebug: \(pending.count) pending notifications (permission \(SystemServices.shared.permissions.notifications))")
        for request in pending {
            let date = (request.trigger as? UNCalendarNotificationTrigger)?.nextTriggerDate()
            print("  \(request.identifier) [\(request.content.categoryIdentifier)] \(date.map { $0.formatted(date: .abbreviated, time: .shortened) } ?? "soon") — \(request.content.title) — \(request.content.body)")
        }
        let planned = AdhanAlarms.plan(settings: SharedRecords.settings.load(), now: .now)
        print("SystemDebug: \(planned.count) adhan alarms planned: \(planned.map { "\($0.prayer) \($0.day) \($0.at.formatted(date: .omitted, time: .shortened)) \($0.id.uuidString)" })")
        let alarms = (try? AlarmManager.shared.alarms) ?? []
        print("SystemDebug: \(alarms.count) adhan alarms (permission \(SystemServices.shared.permissions.alarms))")
        for alarm in alarms {
            if case let .fixed(date)? = alarm.schedule { print("  \(alarm.id) \(alarm.state) \(date.formatted(date: .abbreviated, time: .shortened))") }
        }
        let activity = SystemServices.shared.liveActivity
        print("SystemDebug: Live Activity on \(activity.isOn), running \(activity.isRunning), allowed \(activity.isAllowed)")
    }
}
#endif
