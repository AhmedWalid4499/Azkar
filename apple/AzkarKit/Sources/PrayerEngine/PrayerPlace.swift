import AzkarCore
import Foundation

/// A place as the engine needs it: where, which zone its clocks follow, and which country it is in.
public struct PrayerPlace: Hashable, Sendable {
    public let latitude: Double
    public let longitude: Double
    /// The IANA name the place was saved with; the automatic method falls back on it when the country is unknown.
    public let timeZoneIdentifier: String
    /// The zone days and clock times are read in.
    public let timeZone: TimeZone
    /// ISO 3166-1 alpha-2, any case; `nil` or empty when unknown.
    public let countryCode: String?

    /// `nil` for coordinates that are not on the Earth. An unknown zone falls back to the device's, as on the website.
    public init?(latitude: Double, longitude: Double, timeZoneIdentifier: String, countryCode: String?) {
        guard latitude.isFinite, longitude.isFinite, abs(latitude) <= 90, abs(longitude) <= 180 else { return nil }
        self.latitude = latitude
        self.longitude = longitude
        if let zone = TimeZone(identifier: timeZoneIdentifier) {
            self.timeZoneIdentifier = timeZoneIdentifier
            self.timeZone = zone
        } else {
            self.timeZoneIdentifier = TimeZone.current.identifier
            self.timeZone = TimeZone.current
        }
        self.countryCode = countryCode
    }

    /// The saved location, validated, or `nil` when it cannot be used.
    public init?(_ location: SavedLocation) {
        self.init(latitude: location.latitude, longitude: location.longitude, timeZoneIdentifier: location.timeZone, countryCode: location.countryCode)
    }
}
