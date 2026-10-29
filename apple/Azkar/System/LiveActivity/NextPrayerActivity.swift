import ActivityKit
import AzkarKit
import Foundation
import Observation

/// The "Next prayer" Live Activity on the Lock Screen and in the Dynamic Island, with a live countdown.
///
/// The user turns it on (`start()`, from Today) and off (`stop()`, or by swiping it away). The app
/// moves it on to the following prayer whenever it runs, in the foreground or in a background
/// refresh; between those, once its prayer's time has come it is stale and says so. The system ends
/// a Live Activity after about eight hours; while the choice stays on, the app starts a fresh one the
/// next time it comes to the foreground.
@MainActor
@Observable
final class NextPrayerActivity {
    private static let choiceKey = "system.liveActivity.on"

    /// Whether the user wants it; kept across launches.
    private(set) var isOn: Bool
    /// Whether one is showing now.
    private(set) var isRunning = false

    init() {
        isOn = UserDefaults.standard.bool(forKey: Self.choiceKey)
        isRunning = !Activity<NextPrayerAttributes>.activities.isEmpty
    }

    /// Whether Live Activities are allowed for the app (Settings › Azkar › Live Activities).
    var isAllowed: Bool { ActivityAuthorizationInfo().areActivitiesEnabled }

    /// Starts it, if Live Activities are allowed and a place is saved. Call from the foreground.
    func start(settings: SettingsSnapshot, board: SystemPrayerBoard?) async {
        setChoice(true)
        await update(settings: settings, board: board, canStart: true)
    }

    func stop() async {
        setChoice(false)
        for activity in Activity<NextPrayerAttributes>.activities {
            await activity.end(nil, dismissalPolicy: .immediate)
        }
        isRunning = false
    }

    /// Brings it up to date; with `canStart`, (re)starts it when the user wants one and none is showing.
    func update(settings: SettingsSnapshot, board: SystemPrayerBoard?, canStart: Bool) async {
        let activities = Activity<NextPrayerAttributes>.activities
        guard isOn, let board, let state = NextPrayerAttributes.ContentState(board: board, language: SystemLanguage(settings.app)) else {
            for activity in activities { await activity.end(nil, dismissalPolicy: .immediate) }
            isRunning = false
            return
        }
        // Stale from the moment its prayer comes, until the app moves it on.
        let content = ActivityContent(state: state, staleDate: state.at, relevanceScore: 0.5)
        if let live = activities.first(where: { $0.activityState == .active || $0.activityState == .stale }) {
            let id = live.id
            if live.content.state != state || live.content.staleDate != state.at { await Self.update(id, content) }
            for extra in activities.map(\.id) where extra != id { await Self.end(extra) }
            isRunning = true
        } else if canStart, isAllowed {
            do {
                _ = try Activity.request(attributes: NextPrayerAttributes(), content: content, pushType: nil, style: .standard)
                isRunning = true
            } catch {
                print("Azkar: starting the Live Activity failed: \(error)")
                isRunning = false
            }
        } else {
            isRunning = false
        }
    }

    private nonisolated static func update(_ id: String, _ content: ActivityContent<NextPrayerAttributes.ContentState>) async {
        await Activity<NextPrayerAttributes>.activities.first { $0.id == id }?.update(content)
    }

    private nonisolated static func end(_ id: String) async {
        await Activity<NextPrayerAttributes>.activities.first { $0.id == id }?.end(nil, dismissalPolicy: .immediate)
    }

    /// Follows each activity to its end. One the user swipes away while it is live turns the choice
    /// off; one the system ends (its time limit) does not.
    func follow() async {
        for activity in Activity<NextPrayerAttributes>.activities { watch(activity) }
        for await activity in Activity<NextPrayerAttributes>.activityUpdates { watch(activity) }
    }

    private func watch(_ activity: Activity<NextPrayerAttributes>) {
        Task { [weak self] in
            var last = activity.activityState
            for await state in activity.activityStateUpdates {
                guard let self else { return }
                if state == .dismissed, last == .active || last == .stale { self.setChoice(false) }
                last = state
                self.isRunning = Activity<NextPrayerAttributes>.activities.contains { $0.activityState == .active || $0.activityState == .stale }
            }
        }
    }

    private func setChoice(_ on: Bool) {
        isOn = on
        UserDefaults.standard.set(on, forKey: Self.choiceKey)
    }
}
