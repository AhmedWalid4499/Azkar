import AzkarKit
import Foundation

/// Settings text built in code, and the names of the choices, in the interface language.
enum SettingsText {
    static let table = "Settings"

    static func string(_ key: String.LocalizationValue, locale: Locale) -> String {
        String(localized: LocalizedStringResource(key, table: table, locale: locale))
    }

    static func method(_ method: CalculationMethodID, locale: Locale) -> String {
        switch method {
        case .muslimWorldLeague: string("Muslim World League", locale: locale)
        case .egyptian: string("Egyptian General Authority of Survey", locale: locale)
        case .ummAlQura: string("Umm al-Qura, Makkah", locale: locale)
        case .dubai: string("Dubai (UAE)", locale: locale)
        case .kuwait: string("Kuwait", locale: locale)
        case .qatar: string("Qatar", locale: locale)
        case .turkey: string("Diyanet, Turkey", locale: locale)
        case .tehran: string("Institute of Geophysics, Tehran", locale: locale)
        case .karachi: string("University of Islamic Sciences, Karachi", locale: locale)
        case .singapore: string("Singapore (MUIS)", locale: locale)
        case .northAmerica: string("ISNA, North America", locale: locale)
        case .moonsightingCommittee: string("Moonsighting Committee", locale: locale)
        }
    }

    static func madhab(_ madhab: Madhab, locale: Locale) -> String {
        switch madhab {
        case .shafi: string("Standard", locale: locale)
        case .hanafi: string("Hanafi", locale: locale)
        }
    }

    static func highLatitudeRule(_ rule: HighLatitudeRuleID, locale: Locale) -> String {
        switch rule {
        case .middleOfTheNight: string("Middle of the night", locale: locale)
        case .seventhOfTheNight: string("One-seventh of the night", locale: locale)
        case .twilightAngle: string("Twilight angle", locale: locale)
        }
    }

    static func slot(_ slot: TimeSlot, locale: Locale) -> String {
        switch slot {
        case .fajr: string("Fajr", locale: locale)
        case .sunrise: string("Sunrise", locale: locale)
        case .dhuhr: string("Dhuhr", locale: locale)
        case .asr: string("Asr", locale: locale)
        case .maghrib: string("Maghrib", locale: locale)
        case .isha: string("Isha", locale: locale)
        }
    }

    static func prayer(_ prayer: Prayer, locale: Locale) -> String {
        slot(TimeSlot(rawValue: prayer.rawValue) ?? .fajr, locale: locale)
    }

    static func theme(_ theme: AppSettings.Theme, locale: Locale) -> String {
        switch theme {
        case .system: string("Automatic", locale: locale)
        case .light: string("Light", locale: locale)
        case .dark: string("Dark", locale: locale)
        }
    }

    /// Each language is named in itself, as iOS names them, so it can be found whatever is shown.
    static func language(_ language: AppSettings.Language, locale: Locale) -> String {
        switch language {
        case .system: string("Same as iPhone", locale: locale)
        case .en: "English"
        case .ar: "العربية"
        }
    }

    /// "15 minutes", with the plural Arabic needs.
    static func minutes(_ count: Int, locale: Locale) -> String {
        string("\(count) minutes", locale: locale)
    }

    /// "+5 min", "−3 min", "0 min".
    static func shortMinutes(_ value: Int, locale: Locale) -> String {
        let signed = signed(value, locale: locale)
        return string("\(signed) min", locale: locale)
    }

    /// A signed number of minutes for an adjustment: "+2", "−5", "0".
    static func signed(_ value: Int, locale: Locale) -> String {
        // A true minus sign, as iOS writes negative numbers in prose.
        value.formatted(.number.sign(strategy: .always(includingZero: false)).locale(locale)).replacingOccurrences(of: "-", with: "\u{2212}")
    }
}
