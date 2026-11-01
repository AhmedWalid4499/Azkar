import Foundation

/// Why a day is recommended for a voluntary fast, from the most to the least particular.
/// Raw values match the website's `FASTING_REASONS`.
public enum FastingReason: String, CaseIterable, Codable, Sendable {
    /// 9 Dhu al-Hijjah.
    case arafah
    /// 10 Muharram.
    case ashura
    /// 9 Muharram, fasted with Ashura.
    case tasua
    /// Shawwal after the Eid: six of its days.
    case shawwal
    /// The 13th, 14th and 15th of a Hijri month.
    case whiteDays
    case monday
    case thursday
}

/// Which reminders beyond the prayers and the azkar the user asked for: the fasting days, Ramadan,
/// Friday's Surah al-Kahf and the sunnah prayers. All off to begin with.
public struct SeasonReminderChoices: Hashable, Sendable {
    /// How long before Fajr the suhoor reminder can come, in minutes.
    public static let suhoorLeadChoices = [30, 45, 60, 90]
    /// How long before Maghrib the iftar reminder comes, in minutes.
    public static let iftarLeadMinutes = 15
    /// How long after Isha the Witr reminder can come, in minutes.
    public static let witrDelayChoices = [30, 60, 120, 180]
    /// How long after sunrise the Duha reminder comes, once its time has settled in.
    public static let duhaDelayMinutes = 45
    /// How long after sunrise on Friday the Surah al-Kahf reminder comes.
    public static let kahfDelayMinutes = 60

    public var mondayThursday = false
    public var whiteDays = false
    /// Arafah, Ashura and the day before Ashura.
    public var occasions = false
    public var suhoor = false
    public var suhoorLeadMinutes = 45
    public var iftar = false
    /// The odd nights of the last ten of Ramadan.
    public var oddNights = false
    public var kahf = false
    public var witr = false
    public var witrDelayMinutes = 120
    public var duha = false

    public init() {}

    public var isAnyOn: Bool { mondayThursday || whiteDays || occasions || suhoor || iftar || oddNights || kahf || witr || duha }
}

/// One such reminder on one day, at a time of that day's prayers.
public struct SeasonReminder: Hashable, Sendable {
    public enum Kind: Hashable, Sendable {
        /// Tomorrow is a recommended fast.
        case fast(FastingReason)
        case suhoor
        case iftar
        /// An odd night of the last ten, by its number in Ramadan.
        case oddNight(Int)
        /// Friday's Surah al-Kahf.
        case kahf
        case witr
        case duha
    }

    public var kind: Kind
    public var anchor: TimeSlot
    /// Minutes after `anchor`; before it when negative.
    public var offsetMinutes: Int

    public init(kind: Kind, anchor: TimeSlot, offsetMinutes: Int = 0) {
        self.kind = kind
        self.anchor = anchor
        self.offsetMinutes = offsetMinutes
    }
}

/// A dhikr the user added to the tasbih. Its counts are kept under `id` like a preset's. Removing one
/// only hides it, so the name stays with what was counted.
public struct CustomDhikr: Codable, Hashable, Sendable, Identifiable {
    public static let idPrefix = "custom-"
    public static let maxLength = 200

    public var id: String
    public var text: String
    public var isHidden: Bool

    public init(id: String = "\(CustomDhikr.idPrefix)\(UUID().uuidString.lowercased())", text: String, isHidden: Bool = false) {
        self.id = id
        self.text = text
        self.isHidden = isHidden
    }

    public static func isCustom(_ id: String) -> Bool { id.hasPrefix(idPrefix) }

    /// One line, trimmed, within the limit; `nil` when nothing is left.
    public static func cleaned(_ text: String) -> String? {
        let line = text.split(whereSeparator: \.isNewline).joined(separator: " ").trimmingCharacters(in: .whitespaces)
        return line.isEmpty ? nil : String(line.prefix(maxLength))
    }
}
