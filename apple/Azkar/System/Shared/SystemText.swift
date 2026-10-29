import AzkarKit
import Foundation
import SwiftUI

/// The interface language and number style for text the system shows on the app's behalf
/// (notifications, alarms, the Live Activity, widgets, Siri): the in-app language choice, which can
/// differ from the phone's, with the user's digits and 12- or 24-hour clock.
///
/// Shared by the app and the widget extension.
nonisolated struct SystemLanguage: Hashable, Sendable, Codable {
    /// "en" or "ar".
    var code: String
    /// Arabic-Indic digits in Arabic.
    var arabicDigits: Bool
    var uses24Hour: Bool

    init(code: String, arabicDigits: Bool = true, uses24Hour: Bool = false) {
        self.code = code.hasPrefix("ar") ? "ar" : "en"
        self.arabicDigits = arabicDigits
        self.uses24Hour = uses24Hour
    }

    /// The app's choice, "System" following the language iOS runs this app in.
    init(_ app: AppSettings) {
        let code: String = switch app.language {
        case .en: "en"
        case .ar: "ar"
        case .system: Bundle.main.preferredLocalizations.first ?? Locale.current.language.languageCode?.identifier ?? "en"
        }
        self.init(code: code, arabicDigits: app.arabicDigits, uses24Hour: app.timeFormat == .twentyFourHour)
    }

    var isArabic: Bool { code == "ar" }

    /// The locale numbers, times and durations are formatted in.
    var locale: Locale {
        var components = Locale.Components(languageCode: Locale.LanguageCode(code), languageRegion: Locale.current.region)
        if isArabic { components.numberingSystem = arabicDigits ? "arab" : "latn" }
        components.hourCycle = uses24Hour ? .zeroToTwentyThree : .oneToTwelve
        return Locale(components: components)
    }

    var layoutDirection: LayoutDirection { isArabic ? .rightToLeft : .leftToRight }

    var displayLocale: DisplayLocale { DisplayLocale(language: isArabic ? .ar : .en, arabicIndicDigits: arabicDigits) }
}

/// Text in the `System` string table, looked up in a chosen language rather than the phone's.
/// Keys are the English text.
nonisolated enum SystemText {
    static let table = "System"

    static func string(_ key: String, _ language: SystemLanguage) -> String {
        bundle(language.code).localizedString(forKey: key, value: key, table: table)
    }

    /// A template with `%@` (or `%1$@`, `%2$@`) placeholders, filled in.
    static func format(_ key: String, _ language: SystemLanguage, _ arguments: String...) -> String {
        // Foundation isolates the arguments itself in right-to-left locales: no isolate inside another.
        String(format: string(key, language), locale: language.locale, arguments: arguments)
            .replacing("\u{2068}\u{2068}", with: "\u{2068}")
            .replacing("\u{2069}\u{2069}", with: "\u{2069}")
    }

    /// A name or place inside a sentence of the other script keeps its own direction.
    static func isolate(_ text: String) -> String { "\u{2068}\(text)\u{2069}" }

    private static func bundle(_ code: String) -> Bundle {
        if let path = Bundle.main.path(forResource: code, ofType: "lproj"), let bundle = Bundle(path: path) { return bundle }
        return .main
    }

    // MARK: Names

    static func prayer(_ prayer: Prayer, _ language: SystemLanguage) -> String {
        switch prayer {
        case .fajr: string("Fajr", language)
        case .dhuhr: string("Dhuhr", language)
        case .asr: string("Asr", language)
        case .maghrib: string("Maghrib", language)
        case .isha: string("Isha", language)
        }
    }

    static func status(_ status: PrayerStatus, _ language: SystemLanguage) -> String {
        switch status {
        case .ontime: string("On time", language)
        case .jamaah: string("Jamaah", language)
        case .late: string("Late", language)
        case .missed: string("Missed", language)
        case .excused: string("Excused", language)
        }
    }

    static func session(_ session: AzkarSession, _ language: SystemLanguage) -> String {
        switch session {
        case .morning: string("Morning azkar", language)
        case .evening: string("Evening azkar", language)
        case .sleep: string("Before sleep", language)
        case let .afterPrayer(after): format("After %@", language, Self.prayer(after, language))
        }
    }

    // MARK: Numbers and times

    /// A clock time at the place, as the app shows it.
    static func time(_ date: Date, in timeZone: TimeZone, _ language: SystemLanguage) -> String {
        var style = Date.FormatStyle(date: .omitted, time: .shortened, locale: language.locale, calendar: Calendar(identifier: .gregorian), timeZone: timeZone)
        style.locale = language.locale
        return date.formatted(style)
    }

    /// The time without AM/PM, where space is short ("3:12").
    static func clock(_ date: Date, in timeZone: TimeZone, _ language: SystemLanguage) -> String {
        let style = Date.FormatStyle(locale: language.locale, calendar: Calendar(identifier: .gregorian), timeZone: timeZone)
            .hour(.defaultDigits(amPM: .omitted)).minute()
        return date.formatted(style)
    }

    /// "1 hour, 20 minutes", "15 minutes"; "less than a minute" under one.
    static func duration(minutes: Int, _ language: SystemLanguage) -> String {
        guard minutes >= 1 else { return string("less than a minute", language) }
        let style = Duration.UnitsFormatStyle(allowedUnits: [.hours, .minutes], width: .wide).locale(language.locale)
        return Duration.seconds(minutes * 60).formatted(style)
    }

    /// Whole minutes from `now` to `date`, rounded up so "in 1 minute" never arrives early.
    static func minutes(from now: Date, to date: Date) -> Int {
        max(0, Int((date.timeIntervalSince(now) / 60).rounded(.up)))
    }

    static func number(_ value: Int, _ language: SystemLanguage) -> String {
        value.formatted(.number.locale(language.locale))
    }
}

extension Prayer {
    /// The symbol drawn for each prayer across the system features.
    nonisolated var symbolName: String {
        switch self {
        case .fajr: "sun.horizon"
        case .dhuhr: "sun.max"
        case .asr: "sun.min"
        case .maghrib: "sunset"
        case .isha: "moon.stars"
        }
    }
}

extension PrayerStatus {
    /// One shape per status, so a status never rests on its colour alone.
    nonisolated var symbolName: String {
        switch self {
        case .ontime: "checkmark.circle.fill"
        case .jamaah: "person.2.circle.fill"
        case .late: "clock.arrow.circlepath"
        case .missed: "xmark.circle.fill"
        case .excused: "minus.circle.fill"
        }
    }
}
