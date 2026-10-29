import AzkarKit
import Foundation
import UserNotifications

/// Hands the reminders of the week ahead to the system, as `ReminderPlan` lays them out: prayer
/// times, "not logged yet" and the morning and evening azkar, at most `ReminderPlan.reminderLimit`
/// of them (iOS keeps an app's 64 soonest). Each has the plan's stable id, so scheduling again
/// changes only what moved. Notifications of other features are left alone.
enum ReminderScheduler {
    /// Replaces the pending reminders with those the settings and records ask for now.
    static func reschedule(settings: SettingsSnapshot, logged: [DayKey: Set<Prayer>], now: Date = .now) async {
        let center = UNUserNotificationCenter.current()
        let wanted = plan(settings: settings, logged: logged, now: now)
        let allowed = await center.notificationSettings().authorizationStatus
        let canDeliver = allowed == .authorized || allowed == .provisional || allowed == .ephemeral

        let pending = await center.pendingNotificationRequests().filter { ReminderInfo($0.content.userInfo) != nil }
        let wantedIDs = Set(wanted.map { String($0.id) })
        let obsolete = pending.map(\.identifier).filter { !canDeliver || !wantedIDs.contains($0) }
        center.removePendingNotificationRequests(withIdentifiers: obsolete)
        guard canDeliver, let location = settings.location else { return }

        let context = ReminderContent.Context(
            language: SystemLanguage(settings.app), timeZone: location.zone, place: location.label, name: settings.app.name
        )
        let current = Dictionary(pending.map { ($0.identifier, $0) }, uniquingKeysWith: { first, _ in first })
        for entry in wanted {
            let content = ReminderContent.make(entry, context)
            let id = String(entry.id)
            if let existing = current[id], isSame(existing, content, at: entry.at) { continue }
            let request = UNNotificationRequest(identifier: id, content: content, trigger: trigger(at: entry.at, in: location.zone))
            do {
                try await center.add(request)
            } catch {
                print("Azkar: scheduling reminder \(id) failed: \(error)")
            }
        }
        // Delivered reminders of prayers logged since are done with.
        let delivered = await center.deliveredNotifications().filter { note in
            guard let info = ReminderInfo(note.request.content.userInfo), let prayer = info.prayer, info.kind != .azkar else { return false }
            return logged[info.day]?.contains(prayer) ?? false
        }
        center.removeDeliveredNotifications(withIdentifiers: delivered.map(\.request.identifier))
    }

    /// The reminders due after `now` within the plan's window.
    static func plan(settings: SettingsSnapshot, logged: [DayKey: Set<Prayer>], now: Date) -> [ReminderEntry] {
        guard let location = settings.location, let place = PrayerPlace(location) else { return [] }
        let reminders = settings.reminders
        let choices = ReminderChoices(
            prayers: reminders.prayers, morning: reminders.morningAzkar, evening: reminders.eveningAzkar, morningAt: reminders.morningAt,
            unlogged: reminders.unlogged
                ? UnloggedChoices(leadMinutes: reminders.unloggedLeadMinutes, ishaEnds: reminders.ishaDeadline, logged: logged)
                : nil
        )
        return ReminderPlan.upcoming(
            dayFor: { PrayerCalculator.day($0, at: place, config: settings.calculation) },
            timeZone: place.timeZone, choices: choices, now: now
        )
    }

    /// Whether any reminder switch is on.
    static func wantsNotifications(_ reminders: ReminderSettings) -> Bool {
        reminders.prayers || reminders.unlogged || reminders.morningAzkar || reminders.eveningAzkar
    }

    private static func trigger(at date: Date, in zone: TimeZone) -> UNCalendarNotificationTrigger {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = zone
        var parts = calendar.dateComponents([.year, .month, .day, .hour, .minute, .second], from: date)
        parts.timeZone = zone
        return UNCalendarNotificationTrigger(dateMatching: parts, repeats: false)
    }

    private static func isSame(_ request: UNNotificationRequest, _ content: UNNotificationContent, at date: Date) -> Bool {
        guard let trigger = request.trigger as? UNCalendarNotificationTrigger, let fires = trigger.nextTriggerDate() else { return false }
        return abs(fires.timeIntervalSince(date)) < 1
            && request.content.title == content.title
            && request.content.body == content.body
            && request.content.categoryIdentifier == content.categoryIdentifier
    }
}
