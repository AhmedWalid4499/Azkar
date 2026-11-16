import AzkarKit
import Foundation

/// Text for the Calendar and timetable features, in their own table.
enum PrayerExportText {
    static let table = "PrayerExport"

    static func string(_ key: String.LocalizationValue, locale: Locale) -> String {
        String(localized: LocalizedStringResource(key, table: table, locale: locale))
    }
}

/// A month of the timetable, in the calendar the person chose.
nonisolated enum TimetableMonth: Hashable, Sendable {
    case gregorian(GregorianMonth)
    case hijri(year: Int, month: Int)

    enum Kind: String, CaseIterable, Hashable, Sendable { case gregorian, hijri }

    var kind: Kind {
        switch self {
        case .gregorian: .gregorian
        case .hijri: .hijri
        }
    }

    /// The month of that kind holding `day`.
    static func containing(_ day: DayKey, kind: Kind, hijriOffset: Int) -> TimetableMonth {
        switch kind {
        case .gregorian: return .gregorian(GregorianMonth(day))
        case .hijri:
            let date = HijriCalendar.date(of: day, offset: hijriOffset)
            return .hijri(year: date.year, month: date.month)
        }
    }

    func adding(months: Int) -> TimetableMonth {
        switch self {
        case .gregorian(let month): return .gregorian(month.adding(months: months))
        case .hijri(let year, let month):
            let index = year * 12 + (month - 1) + months
            return .hijri(year: index / 12, month: index % 12 + 1)
        }
    }

    /// The civil days in order.
    func days(hijriOffset: Int) -> [DayKey] {
        switch self {
        case .gregorian(let month): month.days
        case .hijri(let year, let month): HijriCalendar.civilDays(ofYear: year, month: month, offset: hijriOffset)
        }
    }
}

/// Everything printed on a month's timetable, as text in the interface language.
nonisolated struct TimetableDocument: Hashable, Sendable {
    struct Row: Hashable, Sendable {
        var weekday: String
        var date: String
        var otherDate: String
        /// Fajr, sunrise, Dhuhr, Asr, Maghrib and Isha; a dash where a polar day has no time.
        var times: [String]
        var isFriday: Bool
        var isToday: Bool
    }

    var heading: String
    var title: String
    var subtitle: String
    var place: String
    var details: [String]
    var columns: [String]
    var rows: [Row]
    var footer: String
    var isArabic: Bool
    var fileName: String

    /// A month fits one A4 page; a longer list would carry on over more.
    static let rowsPerPage = 31

    var pages: [[Row]] {
        stride(from: 0, to: max(rows.count, 1), by: Self.rowsPerPage).map { Array(rows[$0..<min($0 + Self.rowsPerPage, rows.count)]) }
    }
}

extension TimetableDocument {
    /// The timetable for `month` at the saved place, with the person's method, adjustments, clock,
    /// digits and Hijri offset. `nil` without a usable place or for a month that does not exist.
    @MainActor static func make(month: TimetableMonth, settings: SettingsSnapshot, locale base: Locale, today: DayKey) -> TimetableDocument? {
        guard let location = settings.location, let place = PrayerPlace(location) else { return nil }
        let offset = settings.app.hijriOffset
        let days = month.days(hijriOffset: offset)
        guard let first = days.first, let last = days.last else { return nil }
        let format = TodayFormat(locale: base, timeZone: place.timeZone, settings: settings.app)
        let locale = format.locale
        let display = format.displayLocale
        let prayerDays = PrayerCalculator.days(from: first, count: days.count, at: place, config: settings.calculation)
        let resolved = settings.calculation.resolved(at: place)

        let gmt = Calendar.gregorianGMT
        let weekday = DateFormatter.timetable("EEE", locale: locale)
        let gregorianDay = DateFormatter.timetable("d", locale: locale)
        let gregorianDayMonth = DateFormatter.timetable("dMMM", locale: locale)

        let rows = zip(days, prayerDays).enumerated().map { index, pair in
            let (day, prayers) = pair
            let hijri = HijriCalendar.date(of: day, offset: offset)
            let gregorianText = (index == 0 || day.day == 1 ? gregorianDayMonth : gregorianDay).string(from: day.noonUTC)
            let hijriText = index == 0 || hijri.day == 1 ? HijriFormat.dayAndMonth(hijri, locale: display) : display.number(hijri.day)
            let isHijri = month.kind == .hijri
            return Row(
                weekday: weekday.string(from: day.noonUTC),
                date: isHijri ? display.number(hijri.day) : gregorianDay.string(from: day.noonUTC),
                otherDate: isHijri ? gregorianText : hijriText,
                times: TimeSlot.allCases.map { prayers[$0].map(format.time) ?? "—" },
                isFriday: gmt.component(.weekday, from: day.noonUTC) == 6,
                isToday: day == today
            )
        }

        let title: String
        let subtitle: String
        switch month {
        case .gregorian(let gregorian):
            title = DateFormatter.timetable("MMMMy", locale: locale).string(from: first.noonUTC)
            let span = HijriFormat.span(of: gregorian, offset: offset, locale: display)
            subtitle = span.to.map { "\(span.from) – \($0)" } ?? span.from
        case .hijri(let year, let number):
            title = HijriFormat.monthAndYear(HijriDate(year: year, month: number, day: 1), locale: display)
            subtitle = format.dayRange(first, last)
        }

        func text(_ key: String.LocalizationValue) -> String { PrayerExportText.string(key, locale: base) }
        let method = SettingsText.method(resolved.method, locale: base)
        let madhab = SettingsText.madhab(resolved.madhab, locale: base)
        var details = [text("Calculation method: \(method)"), text("Asr time: \(madhab)")]
        let adjusted = TimeSlot.allCases.filter { settings.calculation.adjustments[$0] != 0 }
        if !adjusted.isEmpty {
            let list = adjusted.map { "\(SettingsText.slot($0, locale: base)) \(SettingsText.signed(settings.calculation.adjustments[$0], locale: base))" }
                .formatted(.list(type: .and, width: .narrow).locale(locale))
            details.append(text("Fine-tuned: \(list)"))
        }
        let otherColumn = month.kind == .hijri ? text("Gregorian") : text("Hijri")
        let heading = text("Prayer times")

        return TimetableDocument(
            heading: heading,
            title: title,
            subtitle: subtitle,
            place: format.place(location),
            details: details,
            columns: [text("Day"), text("Date"), otherColumn] + TimeSlot.allCases.map { SettingsText.slot($0, locale: base) },
            rows: rows,
            footer: text("Calculated by Azkar. Times can differ from your mosque’s by a few minutes; follow your mosque."),
            isArabic: format.isArabic,
            fileName: "\(heading) – \(title)"
        )
    }
}

private extension Calendar {
    nonisolated static let gregorianGMT: Calendar = {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = .gmt
        return calendar
    }()
}

private extension DateFormatter {
    /// Calendar days are read at noon UTC, so no zone moves them.
    static func timetable(_ template: String, locale: Locale) -> DateFormatter {
        let formatter = DateFormatter()
        formatter.locale = locale
        formatter.timeZone = .gmt
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.setLocalizedDateFormatFromTemplate(template)
        return formatter
    }
}
