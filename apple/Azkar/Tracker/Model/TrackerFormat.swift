import AzkarKit
import SwiftUI

/// How the tracker writes words, numbers, dates and times: in the interface language, with
/// Arabic-Indic or Western digits as the user chose, their 12- or 24-hour clock, the week of
/// their region, and times on the saved place's clock.
struct TrackerFormat {
    /// The interface locale with the digits, the hour cycle and the region filled in.
    let locale: Locale
    /// The same choice for the text AzkarKit writes (Hijri dates, the export).
    let display: DisplayLocale
    /// Times are shown on this zone's clock.
    let timeZone: TimeZone
    let hijriOffset: Int
    /// Gregorian, on UTC, in `locale`: formats a `DayKey` (through its `noonUTC`) without any zone moving it.
    let dayCalendar: Calendar

    init(base: Locale, app: AppSettings, timeZone: TimeZone) {
        let arabic = base.language.languageCode == .arabic
        var components = Locale.Components(locale: base)
        if arabic { components.numberingSystem = app.arabicDigits ? "arab" : "latn" }
        components.hourCycle = app.timeFormat == .twelveHour ? .oneToTwelve : .zeroToTwentyThree
        // The week's first day is a regional habit: a bare language takes the device's region.
        if components.region == nil { components.region = Locale.current.region }
        let locale = Locale(components: components)
        self.locale = locale
        display = DisplayLocale(language: arabic ? .ar : .en, arabicIndicDigits: app.arabicDigits)
        self.timeZone = timeZone
        hijriOffset = app.hijriOffset
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC")!
        calendar.locale = locale
        dayCalendar = calendar
    }

    var isArabic: Bool { display.language == .ar }

    /// First day of the week, 1 = Sunday … 7 = Saturday.
    var firstWeekday: Int { dayCalendar.firstWeekday }

    // MARK: Words

    /// A string of the tracker's table in the interface language, its numbers in the chosen digits.
    func string(_ resource: LocalizedStringResource) -> String {
        var resource = resource
        resource.locale = locale
        return String(localized: resource)
    }

    func list(_ items: [String]) -> String {
        items.formatted(.list(type: .and).locale(locale))
    }

    func number(_ value: Int) -> String {
        value.formatted(.number.locale(locale))
    }

    func percent(_ rate: Double) -> String {
        rate.formatted(.percent.precision(.fractionLength(0)).locale(locale))
    }

    // MARK: Days

    private func dayStyle(_ style: Date.FormatStyle) -> Date.FormatStyle {
        var style = style
        style.calendar = dayCalendar
        style.timeZone = dayCalendar.timeZone
        style.locale = locale
        return style
    }

    /// "Wednesday, 29 October 2026".
    func fullDay(_ day: DayKey) -> String {
        day.noonUTC.formatted(dayStyle(Date.FormatStyle(date: .complete, time: .omitted)))
    }

    /// "Wed, 29 Oct".
    func shortDay(_ day: DayKey) -> String {
        day.noonUTC.formatted(dayStyle(Date.FormatStyle().weekday(.abbreviated).day().month(.abbreviated)))
    }

    /// "29 Oct".
    func dayAndMonth(_ day: DayKey) -> String {
        day.noonUTC.formatted(dayStyle(Date.FormatStyle().day().month(.abbreviated)))
    }

    /// A week's first day on a chart axis: "29 Oct", or "٢٩/١٠" in Arabic, whose month names do not shorten.
    func weekLabel(_ day: DayKey) -> String {
        isArabic ? day.noonUTC.formatted(dayStyle(Date.FormatStyle().day().month(.defaultDigits))) : dayAndMonth(day)
    }

    /// "October 2026".
    func monthTitle(_ month: GregorianMonth) -> String {
        month.firstDay.noonUTC.formatted(dayStyle(Date.FormatStyle().month(.wide).year()))
    }

    func dayNumber(_ day: DayKey) -> String { number(day.day) }

    /// Weekday names in the order of the week, starting on `firstWeekday`.
    func weekdaySymbols(short: Bool) -> [String] {
        // Arabic has no abbreviated weekday names; its calendars use the initial letter.
        let names = short ? (isArabic ? dayCalendar.veryShortStandaloneWeekdaySymbols : dayCalendar.shortStandaloneWeekdaySymbols)
            : dayCalendar.standaloneWeekdaySymbols
        let first = firstWeekday - 1
        return Array(names[first...] + names[..<first])
    }

    func weekdayName(_ weekday: Int) -> String {
        dayCalendar.standaloneWeekdaySymbols[(weekday - 1 + 7) % 7]
    }

    func hijri(_ day: DayKey) -> String {
        HijriFormat.full(day, offset: hijriOffset, locale: display)
    }

    func hijriSpan(_ month: GregorianMonth) -> String {
        let span = HijriFormat.span(of: month, offset: hijriOffset, locale: display)
        guard let to = span.to else { return span.from }
        return "\(span.from) – \(to)"
    }

    // MARK: Times

    /// "5:12 AM" on the saved place's clock.
    func time(_ date: Date) -> String {
        var style = Date.FormatStyle(date: .omitted, time: .shortened)
        style.locale = locale
        style.timeZone = timeZone
        return date.formatted(style)
    }

    /// The time alone when `date` falls on `day`, else the day and the time.
    func when(_ date: Date, on day: DayKey) -> String {
        let other = DayKey(date, in: timeZone)
        if other == day { return time(date) }
        return string(LocalizedStringResource("Day and time: \(dayAndMonth(other)), \(time(date))", table: "Tracker"))
    }

    /// A name of the tracker's table as text, in the interface language whatever the system's.
    func text(_ resource: LocalizedStringResource) -> Text { Text(string(resource)) }
}

extension EnvironmentValues {
    /// Set by `TrackerScreen` for everything under it.
    @Entry var trackerFormat = TrackerFormat(base: .current, app: AppSettings(), timeZone: .current)
}
