import AzkarCore
import Foundation

// What "Automatic" stands for at a place, as the website decides it
// (src/features/prayer-times/engine/methods.ts and compute.ts).

/// What the automatic settings resolved to at a place, for the Settings screen.
public struct ResolvedCalculation: Hashable, Sendable {
    public let method: CalculationMethodID
    public let madhab: Madhab
    public let highLatitudeRule: HighLatitudeRuleID

    public init(method: CalculationMethodID, madhab: Madhab, highLatitudeRule: HighLatitudeRuleID) {
        self.method = method
        self.madhab = madhab
        self.highLatitudeRule = highLatitudeRule
    }
}

extension CalculationConfig {
    /// Each "Automatic" setting replaced by what it stands for at `place` (the defaults with no place).
    public func resolved(at place: PrayerPlace?) -> ResolvedCalculation {
        ResolvedCalculation(
            method: method.resolved(at: place),
            madhab: madhab.resolved(at: place),
            highLatitudeRule: highLatitudeRule.resolved
        )
    }
}

extension AutoOr where Value == CalculationMethodID {
    public func resolved(at place: PrayerPlace?) -> CalculationMethodID {
        switch self {
        case .auto: CalculationMethodID.automatic(at: place)
        case let .fixed(method): method
        }
    }
}

extension AutoOr where Value == Madhab {
    public func resolved(at place: PrayerPlace?) -> Madhab {
        switch self {
        case .auto: Madhab.automatic(at: place)
        case let .fixed(madhab): madhab
        }
    }
}

extension AutoOr where Value == HighLatitudeRuleID {
    /// "Automatic" is the twilight-angle rule at every latitude. It steps in only when twilight takes up
    /// more of the night than the method's own angles allow, so ordinary days keep the true angle times.
    /// adhan's own recommendation (one-seventh of the night above 48°) moved Fajr and Isha by 20 to 90
    /// minutes on most days there.
    public var resolved: HighLatitudeRuleID {
        switch self {
        case .auto: .twilightAngle
        case let .fixed(rule): rule
        }
    }
}

extension CalculationMethodID {
    /// The method used where no country's authority is known.
    public static let fallback: CalculationMethodID = .muslimWorldLeague

    /// The preset closest to the timetable the religious authority of the place's country publishes.
    public static func automatic(at place: PrayerPlace?) -> CalculationMethodID {
        automatic(countryCode: place?.countryCode, timeZoneIdentifier: place?.timeZoneIdentifier)
    }

    /// The website's `autoMethod({ countryCode, timeZone })`, for the raw values a place was saved with.
    static func automatic(countryCode: String?, timeZoneIdentifier: String?) -> CalculationMethodID {
        guard let country = PlaceCountry.of(countryCode: countryCode, timeZoneIdentifier: timeZoneIdentifier) else { return fallback }
        return PlaceCountry.method[country] ?? fallback
    }
}

extension Madhab {
    /// The later, Hanafi Asr where nearly every mosque keeps it; the first-shadow Asr everywhere else.
    public static func automatic(at place: PrayerPlace?) -> Madhab {
        automatic(countryCode: place?.countryCode, timeZoneIdentifier: place?.timeZoneIdentifier)
    }

    /// The website's `autoMadhab({ countryCode, timeZone })`, for the raw values a place was saved with.
    static func automatic(countryCode: String?, timeZoneIdentifier: String?) -> Madhab {
        guard let country = PlaceCountry.of(countryCode: countryCode, timeZoneIdentifier: timeZoneIdentifier) else { return .shafi }
        return PlaceCountry.hanafi.contains(country) ? .hanafi : .shafi
    }
}

/// The country tables behind the automatic settings.
enum PlaceCountry {
    /// The country a place is in: the one saved with it, otherwise the one its time zone belongs to.
    static func of(countryCode: String?, timeZoneIdentifier: String?) -> String? {
        if let code = countryCode, !code.isEmpty { return code.uppercased() }
        return timeZoneIdentifier.flatMap(ofZone)
    }

    static func ofZone(_ zone: String) -> String? {
        if let country = zoneCountry[zone] { return country }
        return zonePrefixCountry.first { zone.hasPrefix($0.prefix) }?.country
    }

    /// Country (ISO 3166-1 alpha-2) to the adhan preset closest to the timetable its authority
    /// publishes. Only countries with a clear answer are listed; see methods.ts for the sources.
    static let method: [String: CalculationMethodID] = [
        "EG": .egyptian,
        "SA": .ummAlQura,
        "AE": .dubai,
        "KW": .kuwait,
        "QA": .qatar,
        "TR": .turkey,
        "IR": .tehran,
        "PK": .karachi,
        "IN": .karachi,
        "BD": .karachi,
        "AF": .karachi,
        // JAKIM moved Subuh from 20° to 18° in late 2019: the Karachi preset matches e-solat.gov.my.
        "MY": .karachi,
        "SG": .singapore,
        "ID": .singapore,
        "BN": .singapore,
        "US": .northAmerica,
        "CA": .northAmerica,
        "GB": .moonsightingCommittee,
    ]

    /// Turkey is left out on purpose: Diyanet's timetable uses the first-shadow Asr.
    static let hanafi: Set<String> = ["PK", "IN", "BD", "AF"]

    /// For a place saved without a country (GPS while offline): every zone of the countries above,
    /// under the names browsers and devices report, the older spellings included.
    static let zoneCountry: [String: String] = [
        "Africa/Cairo": "EG",
        "Asia/Riyadh": "SA",
        "Asia/Dubai": "AE",
        "Asia/Kuwait": "KW",
        "Asia/Qatar": "QA",
        "Europe/Istanbul": "TR",
        "Asia/Istanbul": "TR",
        "Asia/Tehran": "IR",
        "Asia/Karachi": "PK",
        "Asia/Kolkata": "IN",
        "Asia/Calcutta": "IN",
        "Asia/Dhaka": "BD",
        "Asia/Dacca": "BD",
        "Asia/Kabul": "AF",
        "Asia/Kuala_Lumpur": "MY",
        "Asia/Kuching": "MY",
        "Asia/Singapore": "SG",
        "Asia/Jakarta": "ID",
        "Asia/Pontianak": "ID",
        "Asia/Makassar": "ID",
        "Asia/Ujung_Pandang": "ID",
        "Asia/Jayapura": "ID",
        "Asia/Brunei": "BN",
        "Europe/London": "GB",
        "Europe/Belfast": "GB",

        "America/New_York": "US",
        "America/Detroit": "US",
        "America/Louisville": "US",
        "America/Indianapolis": "US",
        "America/Fort_Wayne": "US",
        "America/Knox_IN": "US",
        "America/Chicago": "US",
        "America/Menominee": "US",
        "America/Denver": "US",
        "America/Shiprock": "US",
        "America/Boise": "US",
        "America/Phoenix": "US",
        "America/Los_Angeles": "US",
        "America/Anchorage": "US",
        "America/Juneau": "US",
        "America/Sitka": "US",
        "America/Metlakatla": "US",
        "America/Yakutat": "US",
        "America/Nome": "US",
        "America/Adak": "US",
        "America/Atka": "US",
        "Pacific/Honolulu": "US",

        "America/St_Johns": "CA",
        "America/Halifax": "CA",
        "America/Glace_Bay": "CA",
        "America/Moncton": "CA",
        "America/Goose_Bay": "CA",
        "America/Blanc-Sablon": "CA",
        "America/Toronto": "CA",
        "America/Montreal": "CA",
        "America/Nipigon": "CA",
        "America/Thunder_Bay": "CA",
        "America/Iqaluit": "CA",
        "America/Pangnirtung": "CA",
        "America/Atikokan": "CA",
        "America/Coral_Harbour": "CA",
        "America/Winnipeg": "CA",
        "America/Rainy_River": "CA",
        "America/Resolute": "CA",
        "America/Rankin_Inlet": "CA",
        "America/Regina": "CA",
        "America/Swift_Current": "CA",
        "America/Edmonton": "CA",
        "America/Cambridge_Bay": "CA",
        "America/Yellowknife": "CA",
        "America/Inuvik": "CA",
        "America/Creston": "CA",
        "America/Dawson_Creek": "CA",
        "America/Fort_Nelson": "CA",
        "America/Whitehorse": "CA",
        "America/Dawson": "CA",
        "America/Vancouver": "CA",
    ]

    /// Zones named by region under a common prefix: Indiana, Kentucky and North Dakota, and the old `US/` and `Canada/` aliases.
    static let zonePrefixCountry: [(prefix: String, country: String)] = [
        ("America/Indiana/", "US"),
        ("America/Kentucky/", "US"),
        ("America/North_Dakota/", "US"),
        ("US/", "US"),
        ("Canada/", "CA"),
    ]
}
