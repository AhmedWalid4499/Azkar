import AzkarKit
import SwiftUI

// The names, symbols and tints of what the tracker records. Every meaning has a symbol as well
// as a colour, so nothing is told by colour alone.

extension Prayer {
    var trackerName: LocalizedStringResource {
        switch self {
        case .fajr: LocalizedStringResource("Fajr", table: "Tracker")
        case .dhuhr: LocalizedStringResource("Dhuhr", table: "Tracker")
        case .asr: LocalizedStringResource("Asr", table: "Tracker")
        case .maghrib: LocalizedStringResource("Maghrib", table: "Tracker")
        case .isha: LocalizedStringResource("Isha", table: "Tracker")
        }
    }
}

extension TimeSlot {
    var trackerName: LocalizedStringResource {
        prayer?.trackerName ?? LocalizedStringResource("Sunrise", table: "Tracker")
    }
}

extension PrayerStatus {
    var trackerName: LocalizedStringResource {
        switch self {
        case .ontime: LocalizedStringResource("On time", table: "Tracker")
        case .jamaah: LocalizedStringResource("In congregation", table: "Tracker")
        case .late: LocalizedStringResource("Made up (qada)", table: "Tracker")
        case .missed: LocalizedStringResource("Missed", table: "Tracker")
        case .excused: LocalizedStringResource("Excused", table: "Tracker")
        }
    }

    var trackerHint: LocalizedStringResource {
        switch self {
        case .ontime: LocalizedStringResource("Prayed within its time", table: "Tracker")
        case .jamaah: LocalizedStringResource("Prayed in congregation", table: "Tracker")
        case .late: LocalizedStringResource("Made up after its time", table: "Tracker")
        case .missed: LocalizedStringResource("Not prayed", table: "Tracker")
        case .excused: LocalizedStringResource("Not required that day", table: "Tracker")
        }
    }

    /// The symbol of a status in lists and pickers.
    var trackerSymbol: String {
        switch self {
        case .ontime: "checkmark.circle.fill"
        case .jamaah: "person.3.fill"
        case .late: "clock.arrow.circlepath"
        case .missed: "xmark.circle.fill"
        case .excused: "minus.circle.fill"
        }
    }

    /// The small mark of a status in the month calendar: a different shape for each.
    var trackerMark: String {
        switch self {
        case .ontime: "circle.fill"
        case .jamaah: "diamond.fill"
        case .late: "triangle.fill"
        case .missed: "xmark"
        case .excused: "minus"
        }
    }

    var trackerTint: Color {
        switch self {
        case .ontime: .green
        case .jamaah: .teal
        case .late: .orange
        case .missed: .red
        case .excused: .gray
        }
    }

    /// The order the status picker offers them in.
    static let pickerOrder: [PrayerStatus] = [.ontime, .jamaah, .late, .missed, .excused]
}

/// A prayer with nothing logged.
enum TrackerUnloggedPrayer {
    static let name = LocalizedStringResource("Not logged", table: "Tracker")
    static let symbol = "circle.dashed"
    static let mark = "circle"
}

extension SunnahPrayer {
    var trackerName: LocalizedStringResource {
        switch self {
        case .beforeFajr: LocalizedStringResource("2 before Fajr", table: "Tracker")
        case .duha: LocalizedStringResource("Duha", table: "Tracker")
        case .beforeDhuhr: LocalizedStringResource("4 before Dhuhr", table: "Tracker")
        case .afterDhuhr: LocalizedStringResource("2 after Dhuhr", table: "Tracker")
        case .afterMaghrib: LocalizedStringResource("2 after Maghrib", table: "Tracker")
        case .afterIsha: LocalizedStringResource("2 after Isha", table: "Tracker")
        case .qiyam: LocalizedStringResource("Night prayer", table: "Tracker")
        case .witr: LocalizedStringResource("Witr", table: "Tracker")
        }
    }

    var trackerSymbol: String {
        switch self {
        case .beforeFajr: "sunrise"
        case .duha: "sun.max"
        case .beforeDhuhr, .afterDhuhr: "sun.min"
        case .afterMaghrib: "sunset"
        case .afterIsha: "moon"
        case .qiyam: "moon.stars"
        case .witr: "sparkle"
        }
    }
}

extension AzkarSession {
    var trackerName: LocalizedStringResource {
        switch self {
        case .morning: LocalizedStringResource("Morning azkar", table: "Tracker")
        case .evening: LocalizedStringResource("Evening azkar", table: "Tracker")
        case .sleep: LocalizedStringResource("Before sleep", table: "Tracker")
        case let .afterPrayer(prayer): prayer.afterPrayerName
        }
    }

    var trackerSymbol: String {
        switch self {
        case .morning: "sun.max.fill"
        case .evening: "moon.fill"
        case .sleep: "bed.double.fill"
        case .afterPrayer: "hands.and.sparkles.fill"
        }
    }

    var trackerTint: Color {
        switch self {
        case .morning: .orange
        case .evening: .indigo
        case .sleep: .purple
        case .afterPrayer: .mint
        }
    }
}

extension Prayer {
    var afterPrayerName: LocalizedStringResource {
        switch self {
        case .fajr: LocalizedStringResource("After Fajr", table: "Tracker")
        case .dhuhr: LocalizedStringResource("After Dhuhr", table: "Tracker")
        case .asr: LocalizedStringResource("After Asr", table: "Tracker")
        case .maghrib: LocalizedStringResource("After Maghrib", table: "Tracker")
        case .isha: LocalizedStringResource("After Isha", table: "Tracker")
        }
    }
}

extension FastKind {
    var trackerName: LocalizedStringResource {
        switch self {
        case .ramadan: LocalizedStringResource("Ramadan", table: "Tracker")
        case .qada: LocalizedStringResource("Make-up (qada)", table: "Tracker")
        case .voluntary: LocalizedStringResource("Voluntary", table: "Tracker")
        }
    }
}

extension FastStatus {
    var trackerName: LocalizedStringResource {
        switch self {
        case .fasted: LocalizedStringResource("Fasted", table: "Tracker")
        case .broken: LocalizedStringResource("Broke the fast", table: "Tracker")
        case .excused: LocalizedStringResource("Did not fast, with an excuse", table: "Tracker")
        case .missed: LocalizedStringResource("Did not fast", table: "Tracker")
        }
    }

    var trackerSymbol: String {
        switch self {
        case .fasted: "checkmark.circle.fill"
        case .broken: "circle.lefthalf.filled"
        case .excused: "minus.circle.fill"
        case .missed: "xmark.circle.fill"
        }
    }

    var trackerTint: Color {
        switch self {
        case .fasted: .green
        case .broken: .orange
        case .excused: .gray
        case .missed: .red
        }
    }
}

/// The marks of the month calendar besides the prayers.
enum TrackerMark {
    static let morning = "sun.max.fill"
    static let evening = "moon.fill"
    static let fast = "sunset.fill"
}

extension ForbiddenFastDay {
    var trackerNotice: LocalizedStringResource {
        switch self {
        case .eidAlFitr: LocalizedStringResource("Eid al-Fitr: fasting is not permitted on this day.", table: "Tracker")
        case .eidAlAdha: LocalizedStringResource("Eid al-Adha: fasting is not permitted on this day.", table: "Tracker")
        case .tashriq: LocalizedStringResource("A day of Tashriq: fasting is not permitted on this day.", table: "Tracker")
        }
    }
}

extension FastingReason {
    var trackerName: LocalizedStringResource {
        switch self {
        case .arafah: LocalizedStringResource("the Day of Arafah", table: "Tracker")
        case .ashura: LocalizedStringResource("Ashura", table: "Tracker")
        case .tasua: LocalizedStringResource("Tasu’a, the day before Ashura", table: "Tracker")
        case .shawwal: LocalizedStringResource("the six days of Shawwal", table: "Tracker")
        case .whiteDays: LocalizedStringResource("one of the white days", table: "Tracker")
        case .monday: LocalizedStringResource("a Monday", table: "Tracker")
        case .thursday: LocalizedStringResource("a Thursday", table: "Tracker")
        }
    }
}
