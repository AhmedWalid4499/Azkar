import Foundation

/// The app-wide settings, as the website's `src/shared/settings.ts` keeps them.
///
/// Stored (and backed up) in the website's shape. Reading never fails: each field that is not
/// valid falls back to its default on its own, and nothing is coerced (an offset of "1" is not a
/// number), exactly as `sanitizeSettings` does.
public struct AppSettings: Hashable, Sendable {
    /// The interface language. iOS sets an app's language in the system Settings; this is kept
    /// so a backup carries the website's choice over unchanged.
    public enum Language: String, CaseIterable, Codable, Sendable { case system, en, ar }
    public enum Theme: String, CaseIterable, Codable, Sendable { case system, light, dark }
    public enum TimeFormat: String, CaseIterable, Codable, Sendable {
        case twelveHour = "12h"
        case twentyFourHour = "24h"
    }

    public static let hijriOffsetRange = -2...2
    public static let ramadanKhatmahGoalRange = 0...10
    /// Longest name kept, in Unicode scalars (the website's characters of `Array.from`).
    public static let nameMaxLength = 40
    public static let `default` = AppSettings()

    public var language: Language = .system
    public var theme: Theme = .system
    public var timeFormat: TimeFormat = .twelveHour
    /// Arabic-Indic digits (٠١٢٣) when the interface is in Arabic.
    public var arabicDigits = true
    /// Days the Hijri date is shifted to match local moon sighting, -2 to 2.
    public var hijriOffset = 0
    /// What the app calls the user; empty when not given. Always stored through `sanitizeName`.
    public var name = ""
    /// Khatmahs the user means to finish in Ramadan, 0 to 10; 0 is no goal. The native app's own.
    public var ramadanKhatmahGoal = 0

    public init(language: Language = .system, theme: Theme = .system, timeFormat: TimeFormat = .twelveHour,
                arabicDigits: Bool = true, hijriOffset: Int = 0, name: String = "", ramadanKhatmahGoal: Int = 0) {
        self.language = language
        self.theme = theme
        self.timeFormat = timeFormat
        self.arabicDigits = arabicDigits
        self.hijriOffset = hijriOffset
        self.name = name
        self.ramadanKhatmahGoal = ramadanKhatmahGoal
    }

    /// The same settings made valid: the offset and the goal clamped, the name cleaned (as the website's `update`).
    public func sanitized() -> AppSettings {
        var copy = self
        copy.hijriOffset = min(Self.hijriOffsetRange.upperBound, max(Self.hijriOffsetRange.lowerBound, hijriOffset))
        copy.name = Self.sanitizeName(name)
        copy.ramadanKhatmahGoal = min(Self.ramadanKhatmahGoalRange.upperBound, max(Self.ramadanKhatmahGoalRange.lowerBound, ramadanKhatmahGoal))
        return copy
    }

    /// `sanitizeName`: one line, no control or invisible formatting characters (a stray direction
    /// mark would scramble the sentences the name is shown in), trimmed, at most 40 scalars.
    public static func sanitizeName(_ value: String) -> String {
        let normalized = value.precomposedStringWithCanonicalMapping
        var out = String.UnicodeScalarView()
        var pendingSpace = false
        for scalar in normalized.unicodeScalars {
            let category = scalar.properties.generalCategory
            if category == .control || category == .format || scalar == "\u{2028}" || scalar == "\u{2029}" { continue }
            if isJavaScriptSpace(scalar) {
                pendingSpace = true
                continue
            }
            if pendingSpace, !out.isEmpty { out.append(" ") }
            pendingSpace = false
            out.append(scalar)
        }
        // `out` is now trimmed with single spaces; cut it and trim the cut end again.
        let cut = String(String.UnicodeScalarView(out.prefix(nameMaxLength)))
        return cut.hasSuffix(" ") ? String(cut.dropLast()) : cut
    }

    /// JavaScript's `\s` and `trim()` set, less what the control and format filter already removed.
    static func isJavaScriptSpace(_ scalar: Unicode.Scalar) -> Bool {
        switch scalar.value {
        case 0x09...0x0D, 0x20, 0xA0, 0x1680, 0x2000...0x200A, 0x2028, 0x2029, 0x202F, 0x205F, 0x3000, 0xFEFF: true
        default: false
        }
    }
}

extension AppSettings {
    /// `sanitizeSettings(value)`.
    public init(web value: JSONValue?) {
        let stored = value?.object ?? [:]
        self.init()
        if let raw = stored["language"]?.string, let language = Language(rawValue: raw) { self.language = language }
        if let raw = stored["theme"]?.string, let theme = Theme(rawValue: raw) { self.theme = theme }
        if let raw = stored["timeFormat"]?.string, let format = TimeFormat(rawValue: raw) { self.timeFormat = format }
        if let digits = stored["arabicDigits"]?.bool { self.arabicDigits = digits }
        if let offset = stored["hijriOffset"]?.number, WebRules.isInteger(offset) {
            self.hijriOffset = Int(min(Double(Self.hijriOffsetRange.upperBound), max(Double(Self.hijriOffsetRange.lowerBound), offset)))
        }
        self.name = stored["name"]?.string.map(Self.sanitizeName) ?? ""
        if let goal = stored["ramadanKhatmahGoal"]?.number, WebRules.isInteger(goal) {
            self.ramadanKhatmahGoal = Int(min(Double(Self.ramadanKhatmahGoalRange.upperBound), max(Double(Self.ramadanKhatmahGoalRange.lowerBound), goal)))
        }
    }

    /// What the website's settings store saves, and the goal when there is one: the website has no
    /// such field, so without one the settings stay exactly what it writes.
    public var web: JSONValue {
        var fields: [String: JSONValue] = [
            "language": .string(language.rawValue),
            "theme": .string(theme.rawValue),
            "timeFormat": .string(timeFormat.rawValue),
            "arabicDigits": .bool(arabicDigits),
            "hijriOffset": JSONValue(hijriOffset),
            "name": .string(name),
        ]
        if ramadanKhatmahGoal != 0 { fields["ramadanKhatmahGoal"] = JSONValue(ramadanKhatmahGoal) }
        return .object(fields)
    }
}

extension AppSettings: Codable {
    public init(from decoder: Decoder) throws { self.init(web: try JSONValue(from: decoder)) }
    public func encode(to encoder: Encoder) throws { try web.encode(to: encoder) }
}
