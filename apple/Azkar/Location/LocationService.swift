import AzkarKit
import CoreLocation
import Foundation

/// Finds where the user is, for prayer times and the Qibla. Owned by the Settings/Location
/// screens; used by Today's first-run prompt too.
///
/// Everything happens on request: one fix with when-in-use permission, never tracking and
/// never in the background. The place is named with Apple's reverse geocoding from a position
/// rounded to about a kilometre, and city search uses Apple Maps; no other service is contacted.
@MainActor
final class LocationService {
    static let shared = LocationService()

    enum Failure: Error, Equatable {
        case denied
        case restricted
        case servicesOff
        case unavailable
        case timedOut
    }

    /// How long a fix may take once permission is given (the question itself has no limit).
    static let fixTimeout: Duration = .seconds(15)

    private let fixes = LocationFix()

    /// Asks for permission when needed, takes one fix, names the place, and returns it ready to save.
    ///
    /// The coordinates are kept to three decimals (about 100 m), as the website keeps them. When the
    /// place cannot be named (offline), the label is empty and the zone is the device's, which is
    /// where the device is; the times are right either way.
    func locateMe() async throws -> SavedLocation {
        let fix = try await fixes.current(timeout: Self.fixTimeout)
        let latitude = Self.rounded(fix.coordinate.latitude, places: 3)
        let longitude = Self.rounded(fix.coordinate.longitude, places: 3)
        let named = await LocationPlaceNamer.name(latitude: latitude, longitude: longitude, locale: LocationPlaceNamer.interfaceLocale())
        return SavedLocation(
            latitude: latitude,
            longitude: longitude,
            timeZone: named?.timeZone ?? TimeZone.current.identifier,
            label: named?.label ?? "",
            countryCode: named?.countryCode,
            source: .gps,
            updatedAt: Self.nowMilliseconds()
        )
    }

    /// Places matching what the user typed, each with coordinates, zone and country.
    /// Fewer than two letters search for nothing. Throws `Failure.unavailable` when Apple Maps
    /// cannot be reached.
    func search(_ query: String) async throws -> [SavedLocation] {
        try await LocationPlaceNamer.search(query, locale: LocationPlaceNamer.interfaceLocale(), now: Self.nowMilliseconds())
    }

    static func rounded(_ value: Double, places: Int) -> Double {
        let scale = pow(10, Double(places))
        return (value * scale).rounded() / scale
    }

    static func nowMilliseconds() -> Double {
        (Date.now.timeIntervalSince1970 * 1000).rounded()
    }
}
