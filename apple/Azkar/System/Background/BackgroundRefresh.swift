import BackgroundTasks
import os
import Foundation

/// A background app refresh every few hours, so reminders, adhan alarms, the Live Activity, the
/// widgets and the automatic backup stay current even when the app is not opened for days. iOS decides when it really runs.
enum BackgroundRefresh {
    static let identifier = "io.github.ahmedwalid4499.azkar.refresh"
    /// How long after one refresh the next may come.
    static let interval: TimeInterval = 4 * 3600

    /// Must run before the app finishes launching (`SystemAppDelegate`).
    static func register() {
        // On the main queue: this closure belongs to the main actor, and on the scheduler's own
        // queue checking that crashes the app the moment a refresh starts.
        let registered = BGTaskScheduler.shared.register(forTaskWithIdentifier: identifier, using: .main) { task in
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
            if #available(iOS 27.0, *) {
                try await BGTaskScheduler.shared.submitTaskRequest(request)
            } else {
                try BGTaskScheduler.shared.submit(request)
            }
        } catch {
            // Unavailable in the simulator and when Background App Refresh is off.
            print("Azkar: background refresh not scheduled: \(error)")
        }
    }

    private nonisolated static func handle(_ task: BGAppRefreshTask) {
        let box = TaskBox(task)
        let work = Task { @MainActor in
            await schedule()
            guard !Task.isCancelled else { return }
            await SystemServices.shared.refresh(reason: "background refresh")
            guard !Task.isCancelled else { return }
            await AutoBackup.shared.backUp()
            box.complete(success: !Task.isCancelled)
        }
        task.expirationHandler = {
            work.cancel()
            box.complete(success: false)
        }
    }

    /// Carries the system's task across to the main actor, and completes it once: the work and the
    /// expiration handler can both try.
    private nonisolated final class TaskBox: @unchecked Sendable {
        private let task: BGAppRefreshTask
        private let completed = OSAllocatedUnfairLock(initialState: false)

        init(_ task: BGAppRefreshTask) { self.task = task }

        func complete(success: Bool) {
            let first = completed.withLock { done in
                defer { done = true }
                return !done
            }
            if first { task.setTaskCompleted(success: success) }
        }
    }
}
