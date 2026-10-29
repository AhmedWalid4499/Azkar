import Foundation

/// Where the sun is, for the one job adhan does badly: Asr on days when the noon sun is close to
/// the horizon. adhan measures the noon shadow with the declination of 0h UT and takes a single
/// correction step, which drifts by minutes below about ten degrees of noon altitude and falls
/// apart near zero. A port of the website's src/features/prayer-times/engine/solar.ts: the
/// Astronomical Almanac's low-precision formulas, within 0.01° of adhan's own solar position.
enum LowSun {
    private static let degrees = Double.pi / 180
    private static let dayMs = 86_400_000.0
    /// 2000-01-01 12:00 UTC.
    private static let j2000 = 946_728_000_000.0
    /// Bisection stops here; times are rounded to the minute afterwards.
    private static let precisionMs = 500.0

    private static func sinDeg(_ value: Double) -> Double { sin(value * degrees) }
    private static func cosDeg(_ value: Double) -> Double { cos(value * degrees) }

    private static func sunAt(_ instant: Double, longitude: Double) -> (declination: Double, hourAngle: Double) {
        let days = (instant - j2000) / dayMs
        let anomaly = 357.528 + 0.9856003 * days
        let eclipticLongitude = 280.46 + 0.9856474 * days + 1.915 * sinDeg(anomaly) + 0.02 * sinDeg(2 * anomaly)
        let obliquity = 23.439 - 0.0000004 * days
        let rightAscension = atan2(cosDeg(obliquity) * sinDeg(eclipticLongitude), cosDeg(eclipticLongitude)) / degrees
        let siderealTime = 280.46061837 + 360.98564736629 * days
        return (asin(sinDeg(obliquity) * sinDeg(eclipticLongitude)) / degrees, siderealTime + longitude - rightAscension)
    }

    /// Geometric altitude of the sun's centre in degrees, without refraction: how a shadow's length, and with it Asr, is defined.
    static func altitude(at instant: Double, latitude: Double, longitude: Double) -> Double {
        let (declination, hourAngle) = sunAt(instant, longitude: longitude)
        return asin(sinDeg(latitude) * sinDeg(declination) + cosDeg(latitude) * cosDeg(declination) * cosDeg(hourAngle)) / degrees
    }

    /// The instant the sun crosses the meridian of `longitude`, from an estimate within a few hours of it.
    static func transit(near estimate: Double, longitude: Double) -> Double {
        var instant = estimate
        for _ in 0..<3 {
            let (_, hourAngle) = sunAt(instant, longitude: longitude)
            let offset = ((hourAngle + 180).truncatingRemainder(dividingBy: 360) + 360).truncatingRemainder(dividingBy: 360) - 180
            instant -= (offset / 360) * dayMs
        }
        return instant
    }

    /// The first instant after `transit` at which a shadow has grown by `shadowFactor` times its object's
    /// height (1, or 2 for the Hanafi school). NaN when the sun's centre does not clear the horizon at noon.
    static func asr(transit: Double, latitude: Double, longitude: Double, shadowFactor: Double) -> Double {
        let noon = altitude(at: transit, latitude: latitude, longitude: longitude)
        guard noon > 0 else { return .nan }
        let target = atan(1 / (shadowFactor + 1 / tan(noon * degrees))) / degrees

        // From its highest point the sun only sinks until the middle of the night.
        var above = transit
        var below = transit + dayMs / 2
        if altitude(at: below, latitude: latitude, longitude: longitude) > target { return .nan }
        while below - above > precisionMs {
            let middle = (above + below) / 2
            if altitude(at: middle, latitude: latitude, longitude: longitude) > target {
                above = middle
            } else {
                below = middle
            }
        }
        return below
    }
}
