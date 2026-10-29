import AzkarKit
import Foundation

/// The location strings that are built in code (labels, failures), in the interface language.
enum LocationText {
    static let table = "Location"

    static func string(_ key: String.LocalizationValue, locale: Locale) -> String {
        String(localized: LocalizedStringResource(key, table: table, locale: locale))
    }

    /// The place's name, or its coordinates when it has none: "30.04° N, 31.24° E".
    static func label(of location: SavedLocation, locale: Locale) -> String {
        location.label.isEmpty ? coordinates(latitude: location.latitude, longitude: location.longitude, locale: locale) : location.label
    }

    static func coordinates(latitude: Double, longitude: Double, locale: Locale) -> String {
        let style = FloatingPointFormatStyle<Double>.number.precision(.fractionLength(2)).locale(locale)
        let lat = abs(latitude).formatted(style)
        let lon = abs(longitude).formatted(style)
        let latText = latitude < 0 ? string("\(lat)° S", locale: locale) : string("\(lat)° N", locale: locale)
        let lonText = longitude < 0 ? string("\(lon)° W", locale: locale) : string("\(lon)° E", locale: locale)
        return string("latitude \(latText) longitude \(lonText)", locale: locale)
    }

    /// What went wrong, and what the user can do about it.
    static func message(for failure: LocationService.Failure, locale: Locale) -> String {
        switch failure {
        case .denied:
            string("Location access is off for Azkar. Allow it in Settings, or search for your city instead.", locale: locale)
        case .restricted:
            string("Location access is restricted on this iPhone, for example by Screen Time. Search for your city instead.", locale: locale)
        case .servicesOff:
            string("Location Services are turned off. Turn them on in Settings › Privacy & Security, or search for your city.", locale: locale)
        case .unavailable:
            string("Your iPhone couldn’t work out where it is. Try again in a moment, or search for your city.", locale: locale)
        case .timedOut:
            string("Finding your location took too long. Try again, or search for your city.", locale: locale)
        }
    }

    /// Whether the Settings app is where the user can fix it.
    static func opensSettings(_ failure: LocationService.Failure) -> Bool {
        failure == .denied
    }
}
