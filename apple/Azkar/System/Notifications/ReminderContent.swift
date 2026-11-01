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
            let name = SystemText.prayer(prayer, language, on: entry.day)
            let time = SystemText.time(entry.at, in: context.timeZone, language)
            content.title = named.map { SystemText.format("%1$@, it’s time for %2$@", language, $0, name) }
                ?? SystemText.format("It’s time for %@", language, name)
            content.body = context.place.isEmpty ? time : SystemText.format("%1$@ · %2$@", language, time, SystemText.isolate(context.place))
            content.categoryIdentifier = NotificationCategories.prayer
            content.userInfo = ReminderInfo(kind: .prayer, day: entry.day, prayer: prayer).userInfo
            content.threadIdentifier = "prayers"
            content.relevanceScore = 1
        case let .unlogged(prayer, deadline):
            let name = SystemText.prayer(prayer, language, on: entry.day)
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
        case let .season(reminder):
            season(reminder, entry, context, into: content)
        }
        content.sound = .default
        content.interruptionLevel = .active
        return content
    }
}

extension ReminderContent {
    /// A reminder of the fasting days, Ramadan or the sunnah; a tap opens Today, or the mushaf for Surah al-Kahf.
    private static func season(_ reminder: SeasonReminder, _ entry: ReminderEntry, _ context: Context, into content: UNMutableNotificationContent) {
        let language = context.language
        // The time of the prayer the reminder comes before.
        let time = SystemText.time(entry.at.addingTimeInterval(TimeInterval(-reminder.offsetMinutes * 60)), in: context.timeZone, language)
        switch reminder.kind {
        case let .fast(reason):
            content.title = SystemText.string(fastTitle(reason), language)
            content.body = SystemText.string("A good day to fast.", language)
        case .suhoor:
            content.title = SystemText.string("Time for suhoor", language)
            content.body = SystemText.format("Fajr is at %@", language, time)
        case .iftar:
            content.title = SystemText.format("Iftar in %@", language, SystemText.duration(minutes: SeasonReminderChoices.iftarLeadMinutes, language))
            content.body = SystemText.format("Maghrib is at %@", language, time)
        case let .oddNight(night):
            content.title = SystemText.format("Night %@ of Ramadan", language, SystemText.number(night, language))
            content.body = SystemText.string("One of the odd nights of the last ten.", language)
        case .kahf:
            content.title = SystemText.string("Friday: Surah al-Kahf", language)
            content.body = SystemText.string("Open it in the mushaf.", language)
        case .witr:
            content.title = SystemText.string("Time for Witr", language)
            content.body = SystemText.string("Before you sleep.", language)
        case .duha:
            content.title = SystemText.string("Time for Duha", language)
            content.body = SystemText.string("The time for Duha has begun.", language)
        }
        let page = reminder.kind == .kahf ? SeasonReminders.kahfPage : nil
        content.userInfo = ReminderInfo(kind: .season, day: entry.day, quranPage: page).userInfo
        content.threadIdentifier = "season"
        content.relevanceScore = 0.7
    }

    private static func fastTitle(_ reason: FastingReason) -> String {
        switch reason {
        case .arafah: "Tomorrow is the day of Arafah"
        case .ashura: "Tomorrow is Ashura"
        case .tasua: "Tomorrow is the ninth of Muharram"
        case .shawwal: "Tomorrow can be one of the six of Shawwal"
        case .whiteDays: "Tomorrow is one of the White Days"
        case .monday: "Tomorrow is Monday"
        case .thursday: "Tomorrow is Thursday"
        }
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
