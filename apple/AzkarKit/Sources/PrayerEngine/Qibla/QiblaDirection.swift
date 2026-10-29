internal import Adhan
import Foundation

/// The direction of the Kaaba from a place. A port of the website's src/features/qibla/bearing.ts
/// (branch wip/web-seven-features), with the bearing from adhan-swift, whose formula is adhan-js's
/// operation for operation. The two agree to a few billionths of a degree everywhere except at the
/// Kaaba itself and at its antipode, where the direction is undefined and the last bit of the
/// platform's sine decides which way a zero rounds (`isNear` covers the first; the second is in the
/// open Pacific).
public struct QiblaDirection: Hashable, Sendable {
    /// The Kaaba, as adhan places it.
    public static let kaaba = (latitude: 21.4225241, longitude: 39.8261818)
    /// Mean radius of the Earth (IUGG), in kilometres.
    static let earthRadiusKm = 6371.0088
    /// Closer than this, a bearing says little: a saved location is rounded to about 100 m (or is a
    /// city's centre), which at this range swings the direction by tens of degrees.
    public static let nearKaabaKm = 1.0

    /// Great-circle bearing to the Kaaba, in degrees clockwise from true north, 0 ≤ bearing < 360.
    public let bearing: Double
    /// Great-circle distance to the Kaaba, in kilometres.
    public let distanceKm: Double
    /// Too close for a bearing to be useful (see `nearKaabaKm`): show "you are at the Kaaba" instead.
    public var isNear: Bool { distanceKm < Self.nearKaabaKm }

    public init(latitude: Double, longitude: Double) {
        distanceKm = Self.distanceToKaabaKm(latitude: latitude, longitude: longitude)
        // adhan already returns 0 ≤ bearing < 360; the remainder only turns a 360 from rounding into 0.
        bearing = Qibla(coordinates: Coordinates(latitude: latitude, longitude: longitude)).direction.truncatingRemainder(dividingBy: 360)
    }

    /// Haversine distance on a sphere of the Earth's mean radius: within 0.5% of the ellipsoid everywhere.
    public static func distanceToKaabaKm(latitude: Double, longitude: Double) -> Double {
        func radians(_ degrees: Double) -> Double { degrees * Double.pi / 180 }
        let dLat = radians(kaaba.latitude - latitude)
        let dLon = radians(kaaba.longitude - longitude)
        let a = pow(sin(dLat / 2), 2) + cos(radians(latitude)) * cos(radians(kaaba.latitude)) * pow(sin(dLon / 2), 2)
        return 2 * earthRadiusKm * asin(min(1, a.squareRoot()))
    }

    /// The nearest of the eight compass points.
    public var cardinal: CompassPoint { CompassPoint(bearing: bearing) }
}

/// The eight compass points, as the Qibla screen names a direction.
public enum CompassPoint: String, CaseIterable, Sendable {
    case n, ne, e, se, s, sw, w, nw

    /// The nearest point to a bearing in degrees.
    public init(bearing: Double) {
        let normalized = (bearing.truncatingRemainder(dividingBy: 360) + 360).truncatingRemainder(dividingBy: 360)
        // The website's `CARDINALS[NaN] ?? 'n'`.
        guard normalized.isFinite else {
            self = .n
            return
        }
        let index = Int(JS.round(normalized / 45)) % 8
        self = Self.allCases[index]
    }
}
