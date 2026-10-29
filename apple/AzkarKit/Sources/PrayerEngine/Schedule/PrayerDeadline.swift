import AzkarCore
import Foundation

/// When a prayer's time ends, for the "you haven't logged it yet" reminder.
public struct PrayerDeadline: Hashable, Sendable {
    public let endsAt: Date
    /// `endsAt` ends only the preferred time: Isha's at the middle of the night.
    public let preferred: Bool

    public init(endsAt: Date, preferred: Bool) {
        self.endsAt = endsAt
        self.preferred = preferred
    }
}

extension PrayerDay {
    /// When the time of `prayer` on this day ends: Fajr at sunrise, Dhuhr at Asr, Asr at Maghrib,
    /// Maghrib at Isha, and Isha at the middle of the night between Maghrib and the next Fajr, or at
    /// that Fajr. `nil` when a time it depends on does not exist (polar day or night), or when
    /// `nextDay` is not given for Isha.
    public func deadline(for prayer: Prayer, nextDay: PrayerDay?, ishaEnds: IshaDeadline) -> PrayerDeadline? {
        let endedBy: TimeSlot
        switch prayer {
        case .fajr: endedBy = .sunrise
        case .dhuhr: endedBy = .asr
        case .asr: endedBy = .maghrib
        case .maghrib: endedBy = .isha
        case .isha:
            guard let nextFajr = nextDay?[.fajr] else { return nil }
            if ishaEnds == .fajr { return PrayerDeadline(endsAt: nextFajr, preferred: false) }
            guard let maghrib = self[.maghrib] else { return nil }
            // The prayer times are whole minutes, so the middle can fall on half of one: the minute
            // it falls in, so the reminder never promises more time than there is.
            let middle = (JS.instant(maghrib) + JS.instant(nextFajr)) / 2
            let minute = (middle / 60_000).rounded(.down) * 60_000
            return PrayerDeadline(endsAt: Date(timeIntervalSince1970: minute / 1000), preferred: true)
        }
        return self[endedBy].map { PrayerDeadline(endsAt: $0, preferred: false) }
    }
}
