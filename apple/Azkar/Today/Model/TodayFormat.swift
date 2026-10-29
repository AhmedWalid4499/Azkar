import AzkarKit
import Foundation
import SwiftUI

/// How Today writes times, dates and places: in the interface language, with Arabic-Indic or
/// Western digits as the user chose for Arabic, the 12- or 24-hour clock from the settings, and
/// clock times in the saved place's zone.
struct TodayFormat {
    /// The environment's locale with the user's digits applied (see `withDigits`).
    let locale: Locale
    let timeZone: TimeZone
    let hour12: Bool
    let displayLocale: DisplayLocale

    init(locale base: Locale, timeZone: TimeZone, settings: AppSettings) {
        let locale = Self.withDigits(base, arabicDigits: settings.arabicDigits)
        self.locale = locale
        self.timeZone = timeZone
        hour12 = settings.timeFormat == .twelveHour
        displayLocale = DisplayLocale(language: Self.isArabic(locale) ? .ar : .en, arabicIndicDigits: settings.arabicDigits)
    }

    static func isArabic(_ locale: Locale) -> Bool { locale.language.languageCode == .arabic }

    /// Arabic writes numbers in Arabic-Indic digits (٠١٢٣) unless the user turned them off.
    /// Other languages are left as they are.
    static func withDigits(_ locale: Locale, arabicDigits: Bool) -> Locale {
        guard isArabic(locale) else { return locale }
        var components = Locale.Components(locale: locale)
        components.numberingSystem = Locale.NumberingSystem(arabicDigits ? "arab" : "latn")
        return Locale(components: components)
    }

    var isArabic: Bool { Self.isArabic(locale) }

    /// "5:42 PM" or "17:42", in the place's zone.
    func time(_ date: Date) -> String {
        Self.formatter(template: hour12 ? "hmm" : "Hmm", locale: locale, timeZone: timeZone).string(from: date)
    }

    /// "Thursday, 29 October 2026": a calendar day, never moved by a zone.
    func longDay(_ day: DayKey) -> String {
        Self.formatter(template: "EEEEdMMMMy", locale: locale, timeZone: .gmt).string(from: day.noonUTC)
    }

    /// "Wednesday, 28 October": for "counts for …" lines.
    func weekdayAndDate(_ day: DayKey) -> String {
        Self.formatter(template: "EEEEdMMMM", locale: locale, timeZone: .gmt).string(from: day.noonUTC)
    }

    /// The Hijri date with the user's offset, as the website writes it.
    func hijri(_ day: DayKey, offset: Int) -> String {
        HijriFormat.full(day, offset: offset, locale: displayLocale)
    }

    /// The place's name, or its coordinates when it has none ("30.04° N, 31.24° E").
    func place(_ location: SavedLocation) -> String {
        let label = location.label.trimmingCharacters(in: .whitespacesAndNewlines)
        if !label.isEmpty { return label }
        return coordinates(latitude: location.latitude, longitude: location.longitude)
    }

    func coordinates(latitude: Double, longitude: Double) -> String {
        let style = FloatingPointFormatStyle<Double>(locale: locale).precision(.fractionLength(2))
        let lat = abs(latitude).formatted(style)
        let lon = abs(longitude).formatted(style)
        let north = latitude >= 0, east = longitude >= 0
        let latText = isArabic ? "\(lat)° \(north ? "شمالًا" : "جنوبًا")" : "\(lat)° \(north ? "N" : "S")"
        let lonText = isArabic ? "\(lon)° \(east ? "شرقًا" : "غربًا")" : "\(lon)° \(east ? "E" : "W")"
        return isArabic ? "\(latText)، \(lonText)" : "\(latText), \(lonText)"
    }

    // DateFormatter is costly to make; a handful of shapes is all Today uses.
    private static var cache: [String: DateFormatter] = [:]

    private static func formatter(template: String, locale: Locale, timeZone: TimeZone) -> DateFormatter {
        let key = "\(template)|\(locale.identifier)|\(timeZone.identifier)"
        if let cached = cache[key] { return cached }
        let formatter = DateFormatter()
        formatter.locale = locale
        formatter.timeZone = timeZone
        formatter.setLocalizedDateFormatFromTemplate(template)
        cache[key] = formatter
        return formatter
    }
}

extension EnvironmentValues {
    /// Set by `TodayScreen` for everything inside it.
    @Entry var todayFormat = TodayFormat(locale: .current, timeZone: .current, settings: AppSettings())
}
