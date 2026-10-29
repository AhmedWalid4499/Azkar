import AzkarKit
import Foundation
import SwiftUI

/// A string of the Today table (`Today.xcstrings`). Show it with `Text(_:)`; for a plain
/// `String` in the screen's language use `TodayFormat.string(_:)`.
nonisolated func L(_ value: String.LocalizationValue) -> LocalizedStringResource {
    LocalizedStringResource(value, table: "Today")
}

extension TodayFormat {
    /// A Today string resolved in the screen's language and digits.
    func string(_ resource: LocalizedStringResource) -> String {
        var resource = resource
        resource.locale = locale
        return String(localized: resource)
    }
}

extension TimeSlot {
    var title: LocalizedStringResource {
        switch self {
        case .fajr: L("Fajr")
        case .sunrise: L("Sunrise")
        case .dhuhr: L("Dhuhr")
        case .asr: L("Asr")
        case .maghrib: L("Maghrib")
        case .isha: L("Isha")
        }
    }

    var symbol: String {
        switch self {
        case .fajr: "sun.horizon"
        case .sunrise: "sunrise"
        case .dhuhr: "sun.max"
        case .asr: "sun.min"
        case .maghrib: "sunset"
        case .isha: "moon.stars"
        }
    }
}

extension Prayer {
    var title: LocalizedStringResource { TimeSlot(self).title }
}

extension PrayerStatus {
    /// In the order the log offers them.
    static let menuOrder: [PrayerStatus] = [.ontime, .jamaah, .late, .missed, .excused]

    var title: LocalizedStringResource {
        switch self {
        case .ontime: L("On time")
        case .jamaah: L("In congregation")
        case .late: L("Late (qada)")
        case .missed: L("Missed")
        case .excused: L("Excused")
        }
    }

    var hint: LocalizedStringResource {
        switch self {
        case .ontime: L("Prayed within its time")
        case .jamaah: L("Prayed in congregation")
        case .late: L("Made up after its time")
        case .missed: L("Not prayed")
        case .excused: L("Not required that day")
        }
    }

    /// Each status has its own shape, so it never rests on colour alone.
    var symbol: String {
        switch self {
        case .ontime: "checkmark.circle.fill"
        case .jamaah: "person.2.circle.fill"
        case .late: "clock.arrow.circlepath"
        case .missed: "xmark.circle.fill"
        case .excused: "minus.circle.fill"
        }
    }

    var tint: Color {
        switch self {
        case .ontime: .green
        case .jamaah: .teal
        case .late: .orange
        case .missed: .red
        case .excused: .secondary
        }
    }
}

extension SunnahPrayer {
    /// With its rak'ahs for the rawatib: "2 before Fajr".
    var title: LocalizedStringResource {
        switch self {
        case .beforeFajr: L("2 before Fajr")
        case .duha: L("Duha")
        case .beforeDhuhr: L("4 before Dhuhr")
        case .afterDhuhr: L("2 after Dhuhr")
        case .afterMaghrib: L("2 after Maghrib")
        case .afterIsha: L("2 after Isha")
        case .qiyam: L("Night prayer")
        case .witr: L("Witr")
        }
    }
}

extension AzkarSession {
    var title: LocalizedStringResource {
        switch self {
        case .morning: L("Morning azkar")
        case .evening: L("Evening azkar")
        case .sleep: L("Before sleep")
        case let .afterPrayer(prayer):
            switch prayer {
            case .fajr: L("After Fajr")
            case .dhuhr: L("After Dhuhr")
            case .asr: L("After Asr")
            case .maghrib: L("After Maghrib")
            case .isha: L("After Isha")
            }
        }
    }

    var symbol: String {
        switch self {
        case .morning: "sunrise.fill"
        case .evening: "sunset.fill"
        case .sleep: "moon.zzz.fill"
        case .afterPrayer: "hands.and.sparkles.fill"
        }
    }

    var tint: Color {
        switch self {
        case .morning: .orange
        case .evening: .indigo
        case .sleep: .purple
        case .afterPrayer: .teal
        }
    }
}

extension FastingReason {
    func title(hijri: HijriDate, format: TodayFormat) -> LocalizedStringResource {
        switch self {
        case .arafah: L("The day of Arafah")
        case .ashura: L("The day of Ashura")
        case .tasua: L("Tasu‘a, the day before Ashura")
        case .shawwal: L("One of the six days of Shawwal")
        case .whiteDays: L("One of the white days (\(HijriFormat.dayAndMonth(hijri, locale: format.displayLocale)))")
        case .monday: L("Monday")
        case .thursday: L("Thursday")
        }
    }
}
