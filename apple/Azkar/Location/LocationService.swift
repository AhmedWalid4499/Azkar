import AzkarKit
import Foundation

/// Finds where the user is, for prayer times and the Qibla. Owned by the Settings/Location
/// screens; used by Today's first-run prompt too. PLACEHOLDER: the real implementation
/// (Core Location, Apple's reverse geocoding, city search) replaces the bodies, keeping the API.
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

    /// Asks for permission when needed, takes one fix, names the place, and returns it ready to save.
    func locateMe() async throws -> SavedLocation {
        throw Failure.unavailable
    }

    /// Places matching what the user typed, each with coordinates, zone and country.
    func search(_ query: String) async throws -> [SavedLocation] {
        []
    }
}
