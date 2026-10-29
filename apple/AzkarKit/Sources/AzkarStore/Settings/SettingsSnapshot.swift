import AzkarCore
import Foundation

/// Every setting, as plain values.
public struct SettingsSnapshot: Hashable, Sendable {
    public var app = AppSettings()
    /// `nil` until a place is chosen.
    public var location: SavedLocation?
    public var calculation = CalculationConfig()
    public var reminders = ReminderSettings()
    public var reader = ReaderSettings()

    public init(app: AppSettings = AppSettings(), location: SavedLocation? = nil, calculation: CalculationConfig = CalculationConfig(),
                reminders: ReminderSettings = ReminderSettings(), reader: ReaderSettings = ReaderSettings()) {
        self.app = app
        self.location = location
        self.calculation = calculation
        self.reminders = reminders
        self.reader = reader
    }

    /// Each group made valid, as it would be read back from storage.
    public func sanitized(deviceTimeZone: String = TimeZone.current.identifier) -> SettingsSnapshot {
        SettingsSnapshot(
            app: app.sanitized(),
            location: location?.sanitized(deviceTimeZone: deviceTimeZone),
            calculation: CalculationConfig(web: calculation.web),
            reminders: reminders.sanitized(),
            reader: reader.sanitized()
        )
    }

    /// The zone "today" is worked out in: the saved place's, else the device's (as the website's `currentDateKey`).
    public var timeZone: TimeZone { location?.zone ?? .current }
}
