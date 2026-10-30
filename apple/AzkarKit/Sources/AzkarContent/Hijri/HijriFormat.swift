import AzkarCore
import Foundation

/// Hijri dates written as the website writes them with `Intl.DateTimeFormat` and the
/// `islamic-umalqura` calendar: "Jumada I 18, 1448 AH" in English, "١٨ جمادى الأولى ١٤٤٨ هـ"
/// in Arabic. Built from fixed names rather than a formatter, so every device writes the same
/// text the website does (the tests compare with the website's own output).
public enum HijriFormat {
    /// Month names, Muharram first, as ICU writes them.
    public static func monthName(_ month: Int, language: DisplayLanguage) -> String {
        let names = language == .ar ? arabicMonths : englishMonths
        return names[(month - 1 + 12) % 12]
    }

    static let englishMonths = [
        "Muharram", "Safar", "Rabiʻ I", "Rabiʻ II", "Jumada I", "Jumada II",
        "Rajab", "Shaʻban", "Ramadan", "Shawwal", "Dhuʻl-Qiʻdah", "Dhuʻl-Hijjah",
    ]

    static let arabicMonths = [
        "محرم", "صفر", "ربيع الأول", "ربيع الآخر", "جمادى الأولى", "جمادى الآخرة",
        "رجب", "شعبان", "رمضان", "شوال", "ذو القعدة", "ذو الحجة",
    ]

    private static func era(_ locale: DisplayLocale) -> String { locale.language == .ar ? "هـ" : "AH" }

    /// Day, month and year: "Jumada I 18, 1448 AH" or "١٨ جمادى الأولى ١٤٤٨ هـ".
    public static func full(_ date: HijriDate, locale: DisplayLocale) -> String {
        let month = monthName(date.month, language: locale.language)
        let day = locale.number(date.day)
        let year = locale.number(date.year)
        return locale.language == .ar ? "\(day) \(month) \(year) \(era(locale))" : "\(month) \(day), \(year) \(era(locale))"
    }

    /// Month and year: "Jumada I 1448 AH".
    public static func monthAndYear(_ date: HijriDate, locale: DisplayLocale) -> String {
        "\(monthName(date.month, language: locale.language)) \(locale.number(date.year)) \(era(locale))"
    }

    /// The year alone: "1448 AH".
    public static func year(_ date: HijriDate, locale: DisplayLocale) -> String {
        "\(locale.number(date.year)) \(era(locale))"
    }

    /// Day and month, without the year: "Jumada I 18" or "١٨ جمادى الأولى".
    public static func dayAndMonth(_ date: HijriDate, locale: DisplayLocale) -> String {
        let month = monthName(date.month, language: locale.language)
        let day = locale.number(date.day)
        return locale.language == .ar ? "\(day) \(month)" : "\(month) \(day)"
    }

    /// Days running through one month: "Ramadan 1–29" or "١–٢٩ رمضان".
    public static func dayRange(_ first: HijriDate, _ last: HijriDate, locale: DisplayLocale) -> String {
        let month = monthName(first.month, language: locale.language)
        let days = "\(locale.number(first.day))–\(locale.number(last.day))"
        return locale.language == .ar ? "\(days) \(month)" : "\(month) \(days)"
    }

    /// A civil day's Hijri date with the user's offset, as the website's `formatHijri`.
    public static func full(_ day: DayKey, offset: Int, locale: DisplayLocale) -> String {
        full(HijriCalendar.date(of: day, offset: offset), locale: locale)
    }

    /// The Hijri month or months a Gregorian month covers. When both ends share a year it is
    /// written once: "Rabiʻ II" to "Jumada I 1448 AH". `to` is `nil` when the whole month falls
    /// inside one Hijri month. As `hijriSpanOfMonth` on the website.
    public static func span(of month: GregorianMonth, offset: Int = 0, locale: DisplayLocale) -> HijriSpan {
        let start = HijriCalendar.date(of: month.firstDay, offset: offset)
        let end = HijriCalendar.date(of: month.lastDay, offset: offset)
        let from = monthAndYear(start, locale: locale)
        let to = monthAndYear(end, locale: locale)
        if from == to { return HijriSpan(from: from, to: nil) }
        if start.year == end.year { return HijriSpan(from: monthName(start.month, language: locale.language), to: to) }
        return HijriSpan(from: from, to: to)
    }
}

/// The Hijri month or months a Gregorian month covers, for its title.
public struct HijriSpan: Hashable, Sendable {
    public var from: String
    /// `nil` when the whole Gregorian month falls inside one Hijri month.
    public var to: String?

    public init(from: String, to: String?) {
        self.from = from
        self.to = to
    }
}
