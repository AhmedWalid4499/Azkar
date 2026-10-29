import AzkarKit
import Foundation
import UserNotifications

/// The wording of each reminder, as the website's `reminderText` (src/features/prayer-times/reminders/plan.ts
/// and, for "not logged yet", its wip/web-seven-features branch): in the interface language, by name
/// when the user gave one.
enum ReminderContent {
    struct Context {
        var language: SystemLanguage
        var timeZone: TimeZone
        /// The saved place as shown; empty when unknown.
        var place: String
        var name: String
    }

    static func make(_ entry: ReminderEntry, _ context: Context) -> UNMutableNotificationContent {
        let content = UNMutableNotificationContent()
        let language = context.language
        let named = context.name.isEmpty ? nil : SystemText.isolate(context.name)
        switch entry.kind {
        case let .prayer(prayer):
            let name = SystemText.prayer(prayer, language)
            let time = SystemText.time(entry.at, in: context.timeZone, language)
            content.title = named.map { SystemText.format("%1$@, it’s time for %2$@", language, $0, name) }
                ?? SystemText.format("It’s time for %@", language, name)
            content.body = context.place.isEmpty ? time : SystemText.format("%1$@ · %2$@", language, time, SystemText.isolate(context.place))
            content.categoryIdentifier = NotificationCategories.prayer
            content.userInfo = ReminderInfo(kind: .prayer, day: entry.day, prayer: prayer).userInfo
            content.threadIdentifier = "prayers"
            content.relevanceScore = 1
        case let .unlogged(prayer, deadline):
            let name = SystemText.prayer(prayer, language)
            let time = SystemText.time(deadline.endsAt, in: context.timeZone, language)
            let duration = SystemText.duration(minutes: SystemText.minutes(from: entry.at, to: deadline.endsAt), language)
            content.title = named.map { SystemText.format("%1$@, you haven’t logged %2$@ yet", language, $0, name) }
                ?? SystemText.format("You haven’t logged %@ yet", language, name)
            content.body = deadline.preferred
                ? SystemText.format("The preferred time for %1$@ ends in %2$@, at %3$@", language, name, duration, time)
                : SystemText.format("%1$@ time ends in %2$@, at %3$@", language, name, duration, time)
            content.categoryIdentifier = NotificationCategories.unlogged
            content.userInfo = ReminderInfo(kind: .unlogged, day: entry.day, prayer: prayer).userInfo
            content.threadIdentifier = "prayers"
            content.relevanceScore = 0.9
        case let .azkar(session, after):
            let time = SystemText.time(entry.at, in: context.timeZone, language)
            let isMorning = session == .morning
            if let named {
                content.title = SystemText.format(isMorning ? "%@, time for the morning azkar" : "%@, time for the evening azkar", language, named)
            } else {
                content.title = SystemText.string(isMorning ? "Time for the morning azkar" : "Time for the evening azkar", language)
            }
            let bodyKey = switch after {
            case .sunrise: "The sun rose at %@"
            case .asr: "Asr began at %@"
            default: "Fajr began at %@"
            }
            content.body = SystemText.format(bodyKey, language, time)
            content.categoryIdentifier = NotificationCategories.azkar
            content.userInfo = ReminderInfo(kind: .azkar, day: entry.day, session: session).userInfo
            content.threadIdentifier = "azkar"
            content.relevanceScore = 0.6
        }
        content.sound = .default
        content.interruptionLevel = .active
        return content
    }
}

/// The notification categories and their actions.
enum NotificationCategories {
    static let prayer = "azkar.prayer"
    static let unlogged = "azkar.unlogged"
    static let azkar = "azkar.session"

    /// Logs the prayer as on time without opening the app.
    static let prayedAction = "azkar.prayed"
    /// Opens the app where the reminder points.
    static let openAction = "azkar.open"

    static func all(_ language: SystemLanguage) -> Set<UNNotificationCategory> {
        let prayed = UNNotificationAction(
            identifier: prayedAction, title: SystemText.string("Prayed ✓", language),
            options: [], icon: UNNotificationActionIcon(systemImageName: "checkmark.circle")
        )
        let open = UNNotificationAction(
            identifier: openAction, title: SystemText.string("Open", language),
            options: [.foreground], icon: UNNotificationActionIcon(systemImageName: "arrow.up.forward.app")
        )
        let read = UNNotificationAction(
            identifier: openAction, title: SystemText.string("Read now", language),
            options: [.foreground], icon: UNNotificationActionIcon(systemImageName: "book")
        )
        return [
            UNNotificationCategory(identifier: prayer, actions: [prayed, open], intentIdentifiers: []),
            UNNotificationCategory(identifier: unlogged, actions: [prayed, open], intentIdentifiers: []),
            UNNotificationCategory(identifier: azkar, actions: [read], intentIdentifiers: []),
        ]
    }
}
