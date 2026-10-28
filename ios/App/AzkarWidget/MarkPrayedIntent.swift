import AppIntents
import UserNotifications
import WidgetKit

/// A tap on an unlogged prayer in the medium widget: logs it prayed on time. It runs in the
/// widget extension, so it queues the log entry in the App Group for the app to record the next
/// time it starts or comes back (src/features/widget/WidgetSync.tsx), shows the prayer logged
/// at once, and withdraws the app's reminder that the prayer has not been logged.
@available(iOS 17.0, *)
struct MarkPrayedIntent: AppIntent {
    static let title: LocalizedStringResource = "Mark as prayed"
    static let isDiscoverable = false

    @Parameter(title: "Day")
    var date: String

    @Parameter(title: "Prayer")
    var prayer: String

    init() {}

    init(date: String, prayer: String) {
        self.date = date
        self.prayer = prayer
    }

    func perform() async throws -> some IntentResult {
        guard Prayers.all.contains(prayer), let store = WidgetStore.shared() else { return .result() }
        try store.markPrayed(date: date, prayer: prayer, at: Date())
        if let reminder = UnloggedReminder.identifier(date: date, prayer: prayer) {
            let center = UNUserNotificationCenter.current()
            center.removePendingNotificationRequests(withIdentifiers: [reminder])
            center.removeDeliveredNotifications(withIdentifiers: [reminder])
        }
        WidgetCenter.shared.reloadTimelines(ofKind: PrayerTimesWidget.kind)
        return .result()
    }
}
