import BackgroundTasks
import Foundation

/// A background app refresh every few hours, so reminders, adhan alarms, the Live Activity and the
/// widgets stay current even when the app is not opened for days. iOS decides when it really runs.
enum BackgroundRefresh {
    static let identifier = "io.github.ahmedwalid4499.azkar.refresh"
    /// How long after one refresh the next may come.
    static let interval: TimeInterval = 4 * 3600

    /// Must run before the app finishes launching (`SystemAppDelegate`).
    static func register() {
        let registered = BGTaskScheduler.shared.register(forTaskWithIdentifier: identifier, using: nil) { task in
            guard let task = task as? BGAppRefreshTask else {
                task.setTaskCompleted(success: false)
                return
            }
            handle(task)
        }
        if !registered { print("Azkar: background refresh could not be registered") }
    }

    /// Asks for the next refresh (replacing any pending request).
    static func schedule(after delay: TimeInterval = interval) async {
        let request = BGAppRefreshTaskRequest(identifier: identifier)
        request.earliestBeginDate = Date(timeIntervalSinceNow: delay)
        do {
            try await BGTaskScheduler.shared.submitTaskRequest(request)
        } catch {
            // Unavailable in the simulator and when Background App Refresh is off.
            print("Azkar: background refresh not scheduled: \(error)")
        }
    }

    private nonisolated static func handle(_ task: BGAppRefreshTask) {
        let box = TaskBox(task)
        let work = Task { @MainActor in
            await schedule()
            await SystemServices.shared.refresh(reason: "background refresh")
            box.task.setTaskCompleted(success: true)
        }
        task.expirationHandler = {
            work.cancel()
            box.task.setTaskCompleted(success: false)
        }
    }

    /// Carries the system's task across to the main actor; it is only completed once.
    private nonisolated final class TaskBox: @unchecked Sendable {
        let task: BGAppRefreshTask
        init(_ task: BGAppRefreshTask) { self.task = task }
    }
}
