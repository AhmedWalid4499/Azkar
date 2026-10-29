import Foundation

// Reminder choices the records layer stores and the prayer engine plans with.
// Raw values are the strings the website stores.

/// Where Isha's time is taken to end for its "not logged yet" reminder.
public enum IshaDeadline: String, CaseIterable, Codable, Sendable {
    /// The middle of the night between Maghrib and the next Fajr: the end of Isha's preferred time.
    case middle
    /// The next Fajr.
    case fajr
}

/// When the morning azkar reminder comes: as Fajr begins, or once the sun has risen.
public enum MorningReminderTime: String, CaseIterable, Codable, Sendable {
    case fajr
    case sunrise
}
