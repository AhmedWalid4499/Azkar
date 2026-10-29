import Foundation
import Testing
@testable import AzkarStore

/// Changes are announced across processes with Darwin notifications, which reach this process too.
@Suite struct StoreNotificationsTests {
    @Test func aPostedChangeReachesAListener() async {
        let heard = await withTaskGroup(of: Bool.self) { group in
            group.addTask {
                for await _ in StoreNotifications.changes(.records) { return true }
                return false
            }
            group.addTask {
                // Posted until heard (registration completes asynchronously), for two seconds at most.
                for _ in 0..<100 {
                    StoreNotifications.post(.records)
                    try? await Task.sleep(for: .milliseconds(20))
                }
                return false
            }
            let first = await group.next() ?? false
            group.cancelAll()
            return first
        }
        #expect(heard)
    }

    @Test func eachKindOfChangeHasItsOwnSharedName() {
        #expect(StoreChange.records.notificationName == "io.github.ahmedwalid4499.azkar.records-changed")
        #expect(StoreChange.settings.notificationName == "io.github.ahmedwalid4499.azkar.settings-changed")
    }
}
