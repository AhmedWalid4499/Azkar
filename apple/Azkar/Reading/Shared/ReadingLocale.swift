import AzkarKit
import SwiftUI

/// How the Azkar tab writes numbers, times and prose for the interface language: in Arabic,
/// Arabic-Indic or Western digits as the user chose; times in the 12- or 24-hour clock.
nonisolated struct ReadingLocale: Equatable, Sendable {
    /// The interface is in Arabic.
    let isArabic: Bool
    /// For the dataset's prose (references, virtues, notes).
    let display: DisplayLocale
    /// For `Text` interpolation and Foundation formatters: the interface language with the
    /// chosen digits and hour cycle.
    let formatting: Locale
    let timeZone: TimeZone

    init(locale: Locale, app: AppSettings, timeZone: TimeZone) {
        let isArabic = locale.language.languageCode?.identifier == "ar"
        self.isArabic = isArabic
        display = DisplayLocale(language: isArabic ? .ar : .en, arabicIndicDigits: app.arabicDigits)
        var components = Locale.Components(locale: locale)
        components.numberingSystem = Locale.NumberingSystem(isArabic && app.arabicDigits ? "arab" : "latn")
        components.hourCycle = app.timeFormat == .twelveHour ? .oneToTwelve : .zeroToTwentyThree
        formatting = Locale(components: components)
        self.timeZone = timeZone
    }

    /// The language code `ReaderSettings.resolve` reads.
    var languageCode: String { isArabic ? "ar" : "en" }

    func number(_ value: Int) -> String {
        value.formatted(.number.locale(formatting))
    }

    /// A wall-clock time in the place's zone, e.g. "6:12 AM".
    func time(_ date: Date) -> String {
        var style = Date.FormatStyle(date: .omitted, time: .shortened, locale: formatting)
        style.timeZone = timeZone
        return date.formatted(style)
    }

    /// A string of this table in the interface language (for VoiceOver announcements, which are
    /// not `Text`).
    func string(_ resource: LocalizedStringResource) -> String {
        var resource = resource
        resource.locale = formatting
        return String(localized: resource)
    }
}

extension EnvironmentValues {
    /// Set once by `ReadingScreen` for everything under it.
    @Entry var readingLocale = ReadingLocale(locale: .current, app: AppSettings(), timeZone: .current)
}
