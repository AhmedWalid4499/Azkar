import AppIntents
import AzkarKit

// The values Siri, Shortcuts, widgets and controls pass to the app's intents.
// Shared by the app and the widget extension.

nonisolated enum PrayerChoice: String, AppEnum {
    case fajr, dhuhr, asr, maghrib, isha

    static let typeDisplayRepresentation = TypeDisplayRepresentation(name: LocalizedStringResource("Prayer", table: "System"))
    static let caseDisplayRepresentations: [PrayerChoice: DisplayRepresentation] = [
        .fajr: DisplayRepresentation(title: LocalizedStringResource("Fajr", table: "System"), image: .init(systemName: "sun.horizon")),
        .dhuhr: DisplayRepresentation(title: LocalizedStringResource("Dhuhr", table: "System"), image: .init(systemName: "sun.max")),
        .asr: DisplayRepresentation(title: LocalizedStringResource("Asr", table: "System"), image: .init(systemName: "sun.min")),
        .maghrib: DisplayRepresentation(title: LocalizedStringResource("Maghrib", table: "System"), image: .init(systemName: "sunset")),
        .isha: DisplayRepresentation(title: LocalizedStringResource("Isha", table: "System"), image: .init(systemName: "moon.stars")),
    ]

    init(_ prayer: Prayer) { self = PrayerChoice(rawValue: prayer.rawValue)! }

    var prayer: Prayer { Prayer(rawValue: rawValue)! }
}

nonisolated enum PrayerStatusChoice: String, AppEnum {
    case ontime, jamaah, late, missed, excused

    static let typeDisplayRepresentation = TypeDisplayRepresentation(name: LocalizedStringResource("Status", table: "System"))
    static let caseDisplayRepresentations: [PrayerStatusChoice: DisplayRepresentation] = [
        .ontime: DisplayRepresentation(title: LocalizedStringResource("On time", table: "System"), image: .init(systemName: "checkmark.circle.fill")),
        .jamaah: DisplayRepresentation(title: LocalizedStringResource("Jamaah", table: "System"), image: .init(systemName: "person.2.circle.fill")),
        .late: DisplayRepresentation(title: LocalizedStringResource("Late", table: "System"), image: .init(systemName: "clock.arrow.circlepath")),
        .missed: DisplayRepresentation(title: LocalizedStringResource("Missed", table: "System"), image: .init(systemName: "xmark.circle.fill")),
        .excused: DisplayRepresentation(title: LocalizedStringResource("Excused", table: "System"), image: .init(systemName: "minus.circle.fill")),
    ]

    var status: PrayerStatus { PrayerStatus(rawValue: rawValue)! }
}

nonisolated enum SessionChoice: String, AppEnum {
    case morning, evening, sleep
    case afterFajr, afterDhuhr, afterAsr, afterMaghrib, afterIsha

    static let typeDisplayRepresentation = TypeDisplayRepresentation(name: LocalizedStringResource("Azkar", table: "System"))
    static let caseDisplayRepresentations: [SessionChoice: DisplayRepresentation] = [
        .morning: DisplayRepresentation(title: LocalizedStringResource("Morning azkar", table: "System"), image: .init(systemName: "sunrise")),
        .evening: DisplayRepresentation(title: LocalizedStringResource("Evening azkar", table: "System"), image: .init(systemName: "sunset")),
        .sleep: DisplayRepresentation(title: LocalizedStringResource("Before sleep", table: "System"), image: .init(systemName: "bed.double")),
        .afterFajr: DisplayRepresentation(title: LocalizedStringResource("After Fajr", table: "System"), image: .init(systemName: "sun.horizon")),
        .afterDhuhr: DisplayRepresentation(title: LocalizedStringResource("After Dhuhr", table: "System"), image: .init(systemName: "sun.max")),
        .afterAsr: DisplayRepresentation(title: LocalizedStringResource("After Asr", table: "System"), image: .init(systemName: "sun.min")),
        .afterMaghrib: DisplayRepresentation(title: LocalizedStringResource("After Maghrib", table: "System"), image: .init(systemName: "sunset")),
        .afterIsha: DisplayRepresentation(title: LocalizedStringResource("After Isha", table: "System"), image: .init(systemName: "moon.stars")),
    ]

    var session: AzkarSession {
        switch self {
        case .morning: .morning
        case .evening: .evening
        case .sleep: .sleep
        case .afterFajr: .afterPrayer(.fajr)
        case .afterDhuhr: .afterPrayer(.dhuhr)
        case .afterAsr: .afterPrayer(.asr)
        case .afterMaghrib: .afterPrayer(.maghrib)
        case .afterIsha: .afterPrayer(.isha)
        }
    }
}
