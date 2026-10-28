import Foundation

// Settings shared by the prayer engine, the records layer, the app and its widgets.
// Every raw value is the string the website stores, so a backup or the data of the
// web-based app imports without translation.

/// A calculation method, as adhan names it.
public enum CalculationMethodID: String, CaseIterable, Codable, Sendable {
    case muslimWorldLeague = "MuslimWorldLeague"
    case egyptian = "Egyptian"
    case ummAlQura = "UmmAlQura"
    case dubai = "Dubai"
    case kuwait = "Kuwait"
    case qatar = "Qatar"
    case turkey = "Turkey"
    case tehran = "Tehran"
    case karachi = "Karachi"
    case singapore = "Singapore"
    case northAmerica = "NorthAmerica"
    case moonsightingCommittee = "MoonsightingCommittee"
}

/// A setting that is either chosen automatically from the place or set by the user.
public enum AutoOr<Value: RawRepresentable & Sendable & Hashable>: Hashable, Sendable where Value.RawValue == String {
    case auto
    case fixed(Value)

    public var rawValue: String {
        switch self {
        case .auto: "auto"
        case let .fixed(value): value.rawValue
        }
    }

    public init?(rawValue: String) {
        if rawValue == "auto" {
            self = .auto
        } else if let value = Value(rawValue: rawValue) {
            self = .fixed(value)
        } else {
            return nil
        }
    }
}

extension AutoOr: Codable {
    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let raw = try container.decode(String.self)
        guard let value = AutoOr(rawValue: raw) else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Unknown setting \(raw)")
        }
        self = value
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(rawValue)
    }
}

/// The school used for the Asr time.
public enum Madhab: String, CaseIterable, Codable, Sendable {
    /// Shafi'i, Maliki and Hanbali: the shadow equals the object's length.
    case shafi
    /// Twice the object's length: later.
    case hanafi
}

/// How Fajr and Isha are capped where twilight lasts most or all of the night.
public enum HighLatitudeRuleID: String, CaseIterable, Codable, Sendable {
    case middleOfTheNight = "middleofthenight"
    case seventhOfTheNight = "seventhofthenight"
    case twilightAngle = "twilightangle"
}

/// What to do on days when the sun never rises or never sets.
public enum PolarSetting: String, CaseIterable, Codable, Sendable {
    case unresolved
    case nearestLatitude
}

/// Minutes added to each time, -30 to +30.
public struct Adjustments: Codable, Hashable, Sendable {
    public static let limit = 30
    public static let none = Adjustments()

    public var fajr = 0
    public var sunrise = 0
    public var dhuhr = 0
    public var asr = 0
    public var maghrib = 0
    public var isha = 0

    public init(fajr: Int = 0, sunrise: Int = 0, dhuhr: Int = 0, asr: Int = 0, maghrib: Int = 0, isha: Int = 0) {
        self.fajr = fajr
        self.sunrise = sunrise
        self.dhuhr = dhuhr
        self.asr = asr
        self.maghrib = maghrib
        self.isha = isha
    }

    public subscript(slot: TimeSlot) -> Int {
        get {
            switch slot {
            case .fajr: fajr
            case .sunrise: sunrise
            case .dhuhr: dhuhr
            case .asr: asr
            case .maghrib: maghrib
            case .isha: isha
            }
        }
        set {
            let clamped = min(Adjustments.limit, max(-Adjustments.limit, newValue))
            switch slot {
            case .fajr: fajr = clamped
            case .sunrise: sunrise = clamped
            case .dhuhr: dhuhr = clamped
            case .asr: asr = clamped
            case .maghrib: maghrib = clamped
            case .isha: isha = clamped
            }
        }
    }
}

/// Everything that decides the times besides the place and the day.
public struct CalculationConfig: Codable, Hashable, Sendable {
    public static let `default` = CalculationConfig()

    public var method: AutoOr<CalculationMethodID> = .auto
    public var madhab: AutoOr<Madhab> = .auto
    public var highLatitudeRule: AutoOr<HighLatitudeRuleID> = .auto
    public var polar: PolarSetting = .unresolved
    public var adjustments: Adjustments = .none

    public init(
        method: AutoOr<CalculationMethodID> = .auto,
        madhab: AutoOr<Madhab> = .auto,
        highLatitudeRule: AutoOr<HighLatitudeRuleID> = .auto,
        polar: PolarSetting = .unresolved,
        adjustments: Adjustments = .none
    ) {
        self.method = method
        self.madhab = madhab
        self.highLatitudeRule = highLatitudeRule
        self.polar = polar
        self.adjustments = adjustments
    }
}

/// The place prayer times are calculated for.
public struct SavedLocation: Codable, Hashable, Sendable {
    public var latitude: Double
    public var longitude: Double
    /// IANA zone the times are shown in and records are filed by.
    public var timeZone: String
    /// The place's name in the language it was looked up in; empty when unknown (show coordinates then).
    public var label: String
    /// ISO 3166-1 alpha-2, upper-case. Drives the automatic method and Asr school.
    public var countryCode: String?
    public var source: Source
    /// Epoch milliseconds, as the website stores it.
    public var updatedAt: Double

    public enum Source: String, Codable, Sendable {
        case gps
        case manual
    }

    public init(latitude: Double, longitude: Double, timeZone: String, label: String, countryCode: String?, source: Source, updatedAt: Double) {
        self.latitude = latitude
        self.longitude = longitude
        self.timeZone = timeZone
        self.label = label
        self.countryCode = countryCode
        self.source = source
        self.updatedAt = updatedAt
    }

    public var zone: TimeZone { TimeZone(identifier: timeZone) ?? .current }
}
