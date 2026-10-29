import Foundation
import Observation

/// The settings for SwiftUI: read `settings`, change them with `update`.
///
/// ```swift
/// settings.update { $0.app.theme = .dark }
/// ```
///
/// Changes made by another process (a widget's App Intent) arrive as a `StoreChange.settings`
/// notification; call `run()` from the root view's `.task` to read them in.
@MainActor
@Observable
public final class SettingsModel {
    public let store: SettingsStore
    public private(set) var settings: SettingsSnapshot

    public init(store: SettingsStore) {
        self.store = store
        settings = store.load()
    }

    /// Changes the settings: each changed group is made valid and saved, then shown.
    public func update(_ change: (inout SettingsSnapshot) -> Void) {
        let saved = store.update(change)
        if saved != settings { settings = saved }
    }

    /// Reads the settings again.
    public func reload() {
        let loaded = store.load()
        if loaded != settings { settings = loaded }
    }

    /// Reads in every change saved elsewhere, until the calling task is cancelled.
    public func run() async {
        for await _ in StoreNotifications.changes(.settings) { reload() }
    }
}
