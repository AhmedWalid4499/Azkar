import AzkarCore
import Foundation

/// The tracker's spreadsheet export, ported from `src/features/prayer-log/historyCsv.ts`.
///
/// Every recorded day is a row, oldest first. The website's columns come first, unchanged and in
/// the same order: the date and its Hijri date, the time zone, each obligatory prayer's status
/// and when it was logged, when each sunnah prayer was ticked, and the morning, evening and
/// bedtime sessions. Then the native app's own: the azkar after each prayer (the same seven
/// columns as a session), the tasbih counter by preset, and the day's fast. A cell is empty
/// where nothing was recorded. Times are `YYYY-MM-DD HH:mm` on `timeZone`'s wall clock.
public enum HistoryCSV {
    public struct Options: Sendable {
        /// Headers and values are written in this language; the Hijri date also in its digits.
        public var locale: DisplayLocale
        /// IANA zone every time is written in, and named on each row. An unknown one falls back to the device's.
        public var timeZone: String
        public var hijriOffset: Int
        /// Gives the tasbih presets' names and order.
        public var dataset: AzkarDataset

        public init(locale: DisplayLocale, timeZone: String, hijriOffset: Int, dataset: AzkarDataset = .bundled) {
            self.locale = locale
            self.timeZone = timeZone
            self.hijriOffset = hijriOffset
            self.dataset = dataset
        }
    }

    /// Lets Excel recognise the file as UTF-8, so Arabic is not shown as mojibake.
    static let byteOrderMark = "\u{FEFF}"

    /// One CSV field (RFC 4180): quoted when it holds a comma, a quote or a line break, with
    /// quotes doubled. A value that a spreadsheet would run as a formula is kept as text.
    public static func field(_ value: String) -> String {
        let formulaStarts: Set<Unicode.Scalar> = ["=", "+", "-", "@", "\t", "\r"]
        let text = value.unicodeScalars.first.map(formulaStarts.contains) == true ? "'" + value : value
        let needsQuotes = text.unicodeScalars.contains { $0 == "\"" || $0 == "," || $0 == "\r" || $0 == "\n" }
        return needsQuotes ? "\"" + text.replacingOccurrences(of: "\"", with: "\"\"") + "\"" : text
    }

    /// An instant as `YYYY-MM-DD HH:mm` on the wall clock of `zone`: unambiguous, and sorts as text.
    public static func isoMinute(_ date: Date, in zone: TimeZone) -> String {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = zone
        let parts = calendar.dateComponents([.year, .month, .day, .hour, .minute], from: date)
        return String(format: "%04d-%02d-%02d %02d:%02d", parts.year!, parts.month!, parts.day!, parts.hour!, parts.minute!)
    }

    private struct Column {
        var header: String
        var value: (DayKey) -> String
    }

    public static func csv(_ history: TrackerHistory, options: Options) -> String {
        let words = ExportStrings(language: options.locale.language)
        let zone = TimeZone(identifier: options.timeZone) ?? .current
        let time = { (at: Date?) in at.map { isoMinute($0, in: zone) } ?? "" }
        let number = { (value: Int?) in value.map(String.init) ?? "" }

        var columns: [Column] = [
            Column(header: words.date) { $0.description },
            Column(header: words.hijri) { HijriFormat.full($0, offset: options.hijriOffset, locale: options.locale) },
            Column(header: words.timeZone) { _ in zone.identifier },
        ]

        for prayer in Prayer.allCases {
            let name = words.prayer(prayer)
            columns.append(Column(header: words.status(name)) { key in
                history.prayers[key]?.prayers[prayer].map { words.status($0.status) } ?? ""
            })
            columns.append(Column(header: words.loggedAt(name)) { time(history.prayers[$0]?.prayers[prayer]?.loggedAt) })
        }

        for sunnah in SunnahPrayer.allCases {
            columns.append(Column(header: words.sunnah(words.sunnah(sunnah))) { time(history.prayers[$0]?.sunnah[sunnah]) })
        }

        for session in AzkarSession.all {
            let name = words.session(session)
            let record = { (key: DayKey) in history.sessions[key]?[session] }
            columns += [
                Column(header: words.sessionStatus(name)) { key in
                    record(key).map { $0.completed ? words.completed : words.inProgress } ?? ""
                },
                Column(header: words.sessionStartedAt(name)) { time(record($0)?.startedAt) },
                Column(header: words.sessionFinishedAt(name)) { time(record($0)?.completedAt) },
                Column(header: words.sessionLastAt(name)) { time(record($0)?.lastAt) },
                // A completed session counts as read in full, even once "Start over" has begun a second reading.
                Column(header: words.sessionDone(name)) { key in number(record(key).map { $0.completed ? $0.total : $0.done }) },
                Column(header: words.sessionTotal(name)) { number(record($0)?.total) },
                Column(header: words.sessionRecitations(name)) { number(record($0)?.recitations) },
            ]
        }

        for preset in tasbihColumns(history.tasbih, dataset: options.dataset) {
            let name = presetName(preset, dataset: options.dataset, words: words)
            let records = { (key: DayKey) in (history.tasbih[key] ?? []).filter { $0.preset == preset } }
            columns.append(Column(header: words.tasbihCount(name)) { key in
                let found = records(key)
                return found.isEmpty ? "" : String(TasbihStats.count(of: found))
            })
            columns.append(Column(header: words.tasbihLastAt(name)) { time(records($0).compactMap(\.lastAt).max()) })
        }

        columns += [
            Column(header: words.fastKindHeader) { history.fasts[$0].map { words.fastKind($0.kind) } ?? "" },
            Column(header: words.fastStatusHeader) { history.fasts[$0].map { words.fastStatus($0.status) } ?? "" },
            Column(header: words.fastLoggedAtHeader) { time(history.fasts[$0]?.loggedAt) },
        ]

        let line = { (cells: [String]) in cells.map(field).joined(separator: ",") }
        let rows = TrackerStats.recordedDays(history).map { key in line(columns.map { $0.value(key) }) }
        return byteOrderMark + ([line(columns.map(\.header))] + rows).joined(separator: "\r\n") + "\r\n"
    }

    /// The dataset's presets always, in its order, so every export has the same shape; then any
    /// other preset counted (one the dataset no longer has); then the free count.
    static func tasbihColumns(_ history: TasbihHistory, dataset: AzkarDataset) -> [String] {
        let used = Set(history.values.joined().map(\.preset))
        let others = used.subtracting(dataset.tasbihIDs).subtracting([TasbihRecord.freeCount]).sorted()
        return dataset.tasbihIDs + others + [TasbihRecord.freeCount]
    }

    /// In English its transliteration, in Arabic its text, both from the dataset; else its id.
    static func presetName(_ preset: String, dataset: AzkarDataset, words: ExportStrings) -> String {
        if preset == TasbihRecord.freeCount { return words.tasbihFree }
        guard let dhikr = dataset.dhikr(id: preset) else { return preset }
        let name = words.language == .ar ? dhikr.arabic : (dhikr.transliteration ?? dhikr.id)
        return name.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
