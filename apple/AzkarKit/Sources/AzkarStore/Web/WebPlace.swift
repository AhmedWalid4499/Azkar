import AzkarCore
import Foundation

extension CalculationConfig {
    /// `sanitizeSettings` of `src/features/prayer-times/config.ts`, for the calculation fields:
    /// each falls back to its default on its own; adjustments are rounded and clamped to ±30.
    public init(web value: JSONValue?) {
        self.init()
        let stored = value?.object ?? [:]
        if let raw = stored["method"]?.string, let method = AutoOr<CalculationMethodID>(rawValue: raw) { self.method = method }
        if let raw = stored["madhab"]?.string, let madhab = AutoOr<Madhab>(rawValue: raw) { self.madhab = madhab }
        if let raw = stored["highLatitudeRule"]?.string, let rule = AutoOr<HighLatitudeRuleID>(rawValue: raw) { self.highLatitudeRule = rule }
        if let raw = stored["polar"]?.string, let polar = PolarSetting(rawValue: raw) { self.polar = polar }
        let adjustments = stored["adjustments"]?.object ?? [:]
        for slot in TimeSlot.allCases {
            // `typeof minutes === 'number' ? clampAdjustment(minutes) : 0`
            guard let minutes = adjustments[slot.rawValue]?.number, minutes.isFinite else { continue }
            let rounded = WebRules.jsRound(minutes)
            self.adjustments[slot] = Int(min(Double(Adjustments.limit), max(Double(-Adjustments.limit), rounded)))
        }
    }

    /// The calculation fields of the website's prayer-times state.
    public var web: JSONValue {
        [
            "method": .string(method.rawValue),
            "madhab": .string(madhab.rawValue),
            "highLatitudeRule": .string(highLatitudeRule.rawValue),
            "polar": .string(polar.rawValue),
            "adjustments": .object(Dictionary(uniqueKeysWithValues: TimeSlot.allCases.map { ($0.rawValue, JSONValue(adjustments[$0])) })),
        ]
    }

    /// What an install with a place but no saved calculation settings had before the Asr school
    /// could follow the country: the standard Asr (the website's `unsavedSettings`). An update must
    /// never move a prayer by an hour on its own.
    public static let unsavedWithPlace = CalculationConfig(madhab: .fixed(.shafi))
}

extension SavedLocation {
    /// `sanitizeLocation` of `src/shared/location.ts`: no usable coordinates, no place; lesser
    /// damage is repaired. A zone that cannot be used becomes `deviceTimeZone`.
    public init?(web value: JSONValue?, deviceTimeZone: String) {
        guard let raw = value?.object else { return nil }
        func inRange(_ value: JSONValue?, _ range: ClosedRange<Double>) -> Double? {
            guard let number = value?.number, number.isFinite, range.contains(number) else { return nil }
            return number
        }
        guard let latitude = inRange(raw["latitude"], -90...90), let longitude = inRange(raw["longitude"], -180...180) else { return nil }
        let zone = raw["timeZone"]?.string.flatMap(WebRules.timeZone) ?? deviceTimeZone
        let code = raw["countryCode"]?.string.flatMap { code -> String? in
            let letters = code.unicodeScalars
            guard letters.count == 2, letters.allSatisfy({ ("A"..."Z").contains($0) || ("a"..."z").contains($0) }) else { return nil }
            return code.uppercased()
        }
        self.init(
            latitude: latitude,
            longitude: longitude,
            timeZone: zone,
            label: raw["label"]?.string ?? "",
            countryCode: code,
            source: raw["source"] == .string("gps") ? .gps : .manual,
            updatedAt: inRange(raw["updatedAt"], 0...WebRules.maxSafeInteger) ?? 0
        )
    }

    /// What the website's location store saves for the place.
    public var web: JSONValue {
        [
            "latitude": .number(latitude),
            "longitude": .number(longitude),
            "timeZone": .string(timeZone),
            "label": .string(label),
            "countryCode": JSONValue(countryCode),
            "source": .string(source.rawValue),
            "updatedAt": .number(updatedAt),
        ]
    }

    /// The place made valid, as it would be read back from the website's storage.
    public func sanitized(deviceTimeZone: String = TimeZone.current.identifier) -> SavedLocation? {
        SavedLocation(web: web, deviceTimeZone: deviceTimeZone)
    }
}
