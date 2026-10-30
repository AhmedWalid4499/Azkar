import AzkarKit
import Foundation
import SwiftUI

/// A string of the Seasons table (`Seasons.xcstrings`).
nonisolated func SeasonL(_ value: String.LocalizationValue) -> LocalizedStringResource {
    LocalizedStringResource(value, table: "Seasons")
}

extension IslamicOccasion {
    var title: LocalizedStringResource {
        switch self {
        case .hijriNewYear: SeasonL("Hijri New Year")
        case .ashura: SeasonL("Day of Ashura")
        case .ramadan: SeasonL("Ramadan")
        case .eidAlFitr: SeasonL("Eid al-Fitr")
        case .dhulHijjahDays: SeasonL("First ten days of Dhul Hijjah")
        case .arafah: SeasonL("Day of Arafah")
        case .eidAlAdha: SeasonL("Eid al-Adha")
        }
    }

    var symbol: String {
        switch self {
        case .hijriNewYear: "moonphase.waxing.crescent"
        case .ashura: "10.circle"
        case .ramadan: "moon.haze.fill"
        case .eidAlFitr, .eidAlAdha: "sparkles"
        case .dhulHijjahDays: "sparkle"
        case .arafah: "mountain.2.fill"
        }
    }

    var tint: Color {
        switch self {
        case .ramadan: .indigo
        case .eidAlFitr, .eidAlAdha: .orange
        case .hijriNewYear, .ashura, .dhulHijjahDays, .arafah: .accentColor
        }
    }
}

/// How far off a day is: "Today", "Tomorrow", "In 3 days", or "Passed".
func seasonCountdown(from today: DayKey, to day: DayKey) -> LocalizedStringResource {
    let days = today.days(to: day)
    switch days {
    case ..<0: return SeasonL("Passed")
    case 0: return SeasonL("Today")
    case 1: return SeasonL("Tomorrow")
    default: return SeasonL("In \(days) days")
    }
}
