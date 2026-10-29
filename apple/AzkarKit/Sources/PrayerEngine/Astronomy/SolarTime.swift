import Foundation

/// adhan-js's SolarCoordinates: where the sun is on a Julian day, in degrees.
struct SolarCoordinates {
    let declination: Double
    let rightAscension: Double
    let apparentSiderealTime: Double

    init(julianDay: Double) {
        let T = Astro.julianCentury(julianDay)
        let L0 = Astro.meanSolarLongitude(T)
        let Lp = Astro.meanLunarLongitude(T)
        let Omega = Astro.ascendingLunarNodeLongitude(T)
        let Lambda = Astro.degreesToRadians(Astro.apparentSolarLongitude(T, L0))
        let Theta0 = Astro.meanSiderealTime(T)
        let dPsi = Astro.nutationInLongitude(L0, Lp, Omega)
        let dEpsilon = Astro.nutationInObliquity(L0, Lp, Omega)
        let Epsilon0 = Astro.meanObliquityOfTheEcliptic(T)
        let EpsilonApparent = Astro.degreesToRadians(Astro.apparentObliquityOfTheEcliptic(T, Epsilon0))

        declination = Astro.radiansToDegrees(asin(sin(EpsilonApparent) * sin(Lambda)))
        rightAscension = Astro.unwindAngle(Astro.radiansToDegrees(atan2(cos(EpsilonApparent) * sin(Lambda), cos(Lambda))))
        apparentSiderealTime = Theta0 + dPsi * 3600 * cos(Astro.degreesToRadians(Epsilon0 + dEpsilon)) / 3600
    }
}

/// adhan-js's SolarTime: transit, sunrise and sunset of a UTC day, as fractional hours (NaN when they do not happen).
struct SolarTime {
    let latitude: Double
    let longitude: Double
    let solar: SolarCoordinates
    let prevSolar: SolarCoordinates
    let nextSolar: SolarCoordinates
    let approxTransit: Double
    let transit: Double
    let sunrise: Double
    let sunset: Double

    init(year: Int, month: Int, day: Int, latitude: Double, longitude: Double) {
        let julianDay = Astro.julianDay(year: year, month: month, day: day)
        self.latitude = latitude
        self.longitude = longitude
        solar = SolarCoordinates(julianDay: julianDay)
        prevSolar = SolarCoordinates(julianDay: julianDay - 1)
        nextSolar = SolarCoordinates(julianDay: julianDay + 1)
        let m0 = Astro.approximateTransit(longitude, solar.apparentSiderealTime, solar.rightAscension)
        let solarAltitude = -50.0 / 60.0
        approxTransit = m0
        transit = Astro.correctedTransit(m0, longitude, solar.apparentSiderealTime, solar.rightAscension, prevSolar.rightAscension, nextSolar.rightAscension)
        sunrise = Self.hourAngle(m0, solarAltitude, latitude, longitude, false, solar, prevSolar, nextSolar)
        sunset = Self.hourAngle(m0, solarAltitude, latitude, longitude, true, solar, prevSolar, nextSolar)
    }

    private static func hourAngle(
        _ m0: Double, _ angle: Double, _ latitude: Double, _ longitude: Double, _ afterTransit: Bool,
        _ solar: SolarCoordinates, _ prev: SolarCoordinates, _ next: SolarCoordinates
    ) -> Double {
        Astro.correctedHourAngle(
            m0, angle, latitude: latitude, longitude: longitude, afterTransit: afterTransit,
            solar.apparentSiderealTime, solar.rightAscension, prev.rightAscension, next.rightAscension,
            solar.declination, prev.declination, next.declination
        )
    }

    func hourAngle(_ angle: Double, afterTransit: Bool) -> Double {
        Self.hourAngle(approxTransit, angle, latitude, longitude, afterTransit, solar, prevSolar, nextSolar)
    }

    func afternoon(shadowLength: Double) -> Double {
        let tangent = abs(latitude - solar.declination)
        let inverse = shadowLength + tan(Astro.degreesToRadians(tangent))
        let angle = Astro.radiansToDegrees(atan(1.0 / inverse))
        return hourAngle(angle, afterTransit: true)
    }
}

/// adhan-js's TimeComponents: fractional hours of a UTC day, split the way adhan splits them.
enum TimeComponents {
    static func utc(_ hoursValue: Double, year: Int, month: Int, day: Int) -> Instant {
        let hours = hoursValue.rounded(.down)
        let minutes = ((hoursValue - hours) * 60).rounded(.down)
        let seconds = ((hoursValue - (hours + minutes / 60)) * 60 * 60).rounded(.down)
        return JS.utc(year: year, month0: month - 1, day: Double(day), hours: hours, minutes: minutes, seconds: seconds)
    }
}
