import Foundation
import notify

/// What changed in the shared storage.
public enum StoreChange: String, CaseIterable, Sendable {
    case records
    case settings

    /// The Darwin notification name, shared by the app, its widgets and its App Intents.
    public var notificationName: String { "io.github.ahmedwalid4499.azkar.\(rawValue)-changed" }
}

/// Change notifications across processes (Darwin notify). A change made by a widget's App
/// Intent reaches the app, and one made by the app reaches every open model, including the
/// process that made it. They carry no data: read the store again on receipt.
public enum StoreNotifications {
    public static func post(_ change: StoreChange) {
        notify_post(change.notificationName)
    }

    /// Yields once per notification until the stream's task is cancelled.
    public static func changes(_ change: StoreChange) -> AsyncStream<Void> {
        AsyncStream { continuation in
            var token: Int32 = NOTIFY_TOKEN_INVALID
            let status = notify_register_dispatch(change.notificationName, &token, DispatchQueue.global(qos: .utility)) { _ in
                continuation.yield()
            }
            guard status == NOTIFY_STATUS_OK else {
                continuation.finish()
                return
            }
            let registered = token
            continuation.onTermination = { _ in notify_cancel(registered) }
        }
    }
}
