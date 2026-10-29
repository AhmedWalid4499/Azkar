import Foundation

// A line-for-line port of the astronomy in adhan-js 4.4.6, the library the website runs
// (node_modules/adhan/lib/esm/Astronomical.js and MathUtils.js). Every expression keeps
// the order of operations of the original, so the doubles come out bit for bit the same.
// adhan-swift 1.5.0 carries the same formulas but keeps them internal.

enum Astro {
    static func degreesToRadians(_ degrees: Double) -> Double { degrees * Double.pi / 180.0 }
    static func radiansToDegrees(_ radians: Double) -> Double { radians * 180.0 / Double.pi }

    static func normalizeToScale(_ number: Double, _ max: Double) -> Double {
        number - max * (number / max).rounded(.down)
    }

    static func unwindAngle(_ angle: Double) -> Double { normalizeToScale(angle, 360.0) }

    static func quadrantShiftAngle(_ angle: Double) -> Double {
        if angle >= -180, angle <= 180 { return angle }
        return angle - 360 * JS.round(angle / 360)
    }

    static func meanSolarLongitude(_ T: Double) -> Double {
        let term1 = 280.4664567
        let term2 = 36000.76983 * T
        let term3 = 0.0003032 * pow(T, 2)
        return unwindAngle(term1 + term2 + term3)
    }

    static func meanLunarLongitude(_ T: Double) -> Double {
        let term1 = 218.3165
        let term2 = 481267.8813 * T
        return unwindAngle(term1 + term2)
    }

    static func ascendingLunarNodeLongitude(_ T: Double) -> Double {
        let term1 = 125.04452
        let term2 = 1934.136261 * T
        let term3 = 0.0020708 * pow(T, 2)
        let term4 = pow(T, 3) / 450000
        return unwindAngle(term1 - term2 + term3 + term4)
    }

    static func meanSolarAnomaly(_ T: Double) -> Double {
        let term1 = 357.52911
        let term2 = 35999.05029 * T
        let term3 = 0.0001537 * pow(T, 2)
        return unwindAngle(term1 + term2 - term3)
    }

    static func solarEquationOfTheCenter(_ T: Double, _ meanAnomaly: Double) -> Double {
        let Mrad = degreesToRadians(meanAnomaly)
        let term1 = (1.914602 - 0.004817 * T - 0.000014 * pow(T, 2)) * sin(Mrad)
        let term2 = (0.019993 - 0.000101 * T) * sin(2 * Mrad)
        let term3 = 0.000289 * sin(3 * Mrad)
        return term1 + term2 + term3
    }

    static func apparentSolarLongitude(_ T: Double, _ meanLongitude: Double) -> Double {
        let longitude = meanLongitude + solarEquationOfTheCenter(T, meanSolarAnomaly(T))
        let Omega = 125.04 - 1934.136 * T
        let Lambda = longitude - 0.00569 - 0.00478 * sin(degreesToRadians(Omega))
        return unwindAngle(Lambda)
    }

    static func meanObliquityOfTheEcliptic(_ T: Double) -> Double {
        let term1 = 23.439291
        let term2 = 0.013004167 * T
        let term3 = 0.0000001639 * pow(T, 2)
        let term4 = 0.0000005036 * pow(T, 3)
        return term1 - term2 - term3 + term4
    }

    static func apparentObliquityOfTheEcliptic(_ T: Double, _ meanObliquity: Double) -> Double {
        let O = 125.04 - 1934.136 * T
        return meanObliquity + 0.00256 * cos(degreesToRadians(O))
    }

    static func meanSiderealTime(_ T: Double) -> Double {
        let JD = T * 36525 + 2451545.0
        let term1 = 280.46061837
        let term2 = 360.98564736629 * (JD - 2451545)
        let term3 = 0.000387933 * pow(T, 2)
        let term4 = pow(T, 3) / 38710000
        return unwindAngle(term1 + term2 + term3 - term4)
    }

    static func nutationInLongitude(_ L0: Double, _ Lp: Double, _ Omega: Double) -> Double {
        let term1 = -17.2 / 3600 * sin(degreesToRadians(Omega))
        let term2 = 1.32 / 3600 * sin(2 * degreesToRadians(L0))
        let term3 = 0.23 / 3600 * sin(2 * degreesToRadians(Lp))
        let term4 = 0.21 / 3600 * sin(2 * degreesToRadians(Omega))
        return term1 - term2 - term3 + term4
    }

    static func nutationInObliquity(_ L0: Double, _ Lp: Double, _ Omega: Double) -> Double {
        let term1 = 9.2 / 3600 * cos(degreesToRadians(Omega))
        let term2 = 0.57 / 3600 * cos(2 * degreesToRadians(L0))
        let term3 = 0.1 / 3600 * cos(2 * degreesToRadians(Lp))
        let term4 = 0.09 / 3600 * cos(2 * degreesToRadians(Omega))
        return term1 + term2 + term3 - term4
    }

    static func altitudeOfCelestialBody(_ latitude: Double, _ declination: Double, _ hourAngle: Double) -> Double {
        let term1 = sin(degreesToRadians(latitude)) * sin(degreesToRadians(declination))
        let term2 = cos(degreesToRadians(latitude)) * cos(degreesToRadians(declination)) * cos(degreesToRadians(hourAngle))
        return radiansToDegrees(asin(term1 + term2))
    }

    static func approximateTransit(_ longitude: Double, _ siderealTime: Double, _ rightAscension: Double) -> Double {
        let Lw = longitude * -1
        let m0 = normalizeToScale((rightAscension + Lw - siderealTime) / 360, 1)
        // adhan's own correction near the date line: an m0 more than half a day from the
        // transit the longitude implies belongs to the neighbouring day.
        let expectedTransit = normalizeToScale((12.0 - longitude / 15.0) / 24.0, 1)
        if m0 - expectedTransit > 0.5 { return m0 - 1.0 }
        if expectedTransit - m0 > 0.5 { return m0 + 1.0 }
        return m0
    }

    static func correctedTransit(
        _ m0: Double, _ longitude: Double, _ siderealTime: Double,
        _ a2: Double, _ a1: Double, _ a3: Double
    ) -> Double {
        let Lw = longitude * -1
        let Theta = unwindAngle(siderealTime + 360.985647 * m0)
        let a = unwindAngle(interpolateAngles(a2, a1, a3, m0))
        let H = quadrantShiftAngle(Theta - Lw - a)
        let dm = H / -360
        return (m0 + dm) * 24
    }

    static func correctedHourAngle(
        _ m0: Double, _ h0: Double, latitude: Double, longitude: Double, afterTransit: Bool,
        _ siderealTime: Double, _ a2: Double, _ a1: Double, _ a3: Double,
        _ d2: Double, _ d1: Double, _ d3: Double
    ) -> Double {
        let Lw = longitude * -1
        let term1 = sin(degreesToRadians(h0)) - sin(degreesToRadians(latitude)) * sin(degreesToRadians(d2))
        let term2 = cos(degreesToRadians(latitude)) * cos(degreesToRadians(d2))
        let H0 = radiansToDegrees(acos(term1 / term2))
        let m = afterTransit ? m0 + H0 / 360 : m0 - H0 / 360
        let Theta = unwindAngle(siderealTime + 360.985647 * m)
        let a = unwindAngle(interpolateAngles(a2, a1, a3, m))
        let delta = interpolate(d2, d1, d3, m)
        let H = Theta - Lw - a
        let h = altitudeOfCelestialBody(latitude, delta, H)
        let term3 = h - h0
        let term4 = 360 * cos(degreesToRadians(delta)) * cos(degreesToRadians(latitude)) * sin(degreesToRadians(H))
        let dm = term3 / term4
        return (m + dm) * 24
    }

    static func interpolate(_ y2: Double, _ y1: Double, _ y3: Double, _ n: Double) -> Double {
        let a = y2 - y1
        let b = y3 - y2
        let c = b - a
        return y2 + n / 2 * (a + b + n * c)
    }

    static func interpolateAngles(_ y2: Double, _ y1: Double, _ y3: Double, _ n: Double) -> Double {
        let a = unwindAngle(y2 - y1)
        let b = unwindAngle(y3 - y2)
        let c = b - a
        return y2 + n / 2 * (a + b + n * c)
    }

    static func julianDay(year: Int, month: Int, day: Int) -> Double {
        let Y = Double(month > 2 ? year : year - 1)
        let M = Double(month > 2 ? month : month + 12)
        let D = Double(day)
        let A = (Y / 100).rounded(.towardZero)
        let B = (2 - A + (A / 4).rounded(.towardZero)).rounded(.towardZero)
        let i0 = (365.25 * (Y + 4716)).rounded(.towardZero)
        let i1 = (30.6001 * (M + 1)).rounded(.towardZero)
        return i0 + i1 + D + B - 1524.5
    }

    static func julianCentury(_ julianDay: Double) -> Double {
        (julianDay - 2451545.0) / 36525
    }

    static func isLeapYear(_ year: Int) -> Bool {
        if year % 4 != 0 { return false }
        if year % 100 == 0, year % 400 != 0 { return false }
        return true
    }

    static func daysSinceSolstice(dayOfYear: Int, year: Int, latitude: Double) -> Int {
        let northernOffset = 10
        let southernOffset = isLeapYear(year) ? 173 : 172
        let daysInYear = isLeapYear(year) ? 366 : 365
        if latitude >= 0 {
            let days = dayOfYear + northernOffset
            return days >= daysInYear ? days - daysInYear : days
        }
        let days = dayOfYear - southernOffset
        return days < 0 ? days + daysInYear : days
    }

    /// The seasonal interpolation both Moonsighting Committee twilights share.
    private static func seasonal(_ a: Double, _ b: Double, _ c: Double, _ d: Double, _ dyy: Double) -> Double {
        if dyy < 91 { return a + (b - a) / 91.0 * dyy }
        if dyy < 137 { return b + (c - b) / 46.0 * (dyy - 91) }
        if dyy < 183 { return c + (d - c) / 46.0 * (dyy - 137) }
        if dyy < 229 { return d + (c - d) / 46.0 * (dyy - 183) }
        if dyy < 275 { return c + (b - c) / 46.0 * (dyy - 229) }
        return b + (a - b) / 91.0 * (dyy - 275)
    }

    static func seasonAdjustedMorningTwilight(latitude: Double, dayOfYear: Int, year: Int, sunrise: Instant) -> Instant {
        let a = 75 + 28.65 / 55.0 * abs(latitude)
        let b = 75 + 19.44 / 55.0 * abs(latitude)
        let c = 75 + 32.74 / 55.0 * abs(latitude)
        let d = 75 + 48.1 / 55.0 * abs(latitude)
        let dyy = Double(daysSinceSolstice(dayOfYear: dayOfYear, year: year, latitude: latitude))
        let adjustment = seasonal(a, b, c, d, dyy)
        return JS.date(sunrise + JS.round(adjustment * -60.0) * 1000)
    }

    static func seasonAdjustedEveningTwilight(latitude: Double, dayOfYear: Int, year: Int, sunset: Instant) -> Instant {
        // Shafaq "general", the only one the presets use.
        let a = 75 + 25.6 / 55.0 * abs(latitude)
        let b = 75 + 2.05 / 55.0 * abs(latitude)
        let c = 75 - 9.21 / 55.0 * abs(latitude)
        let d = 75 + 6.14 / 55.0 * abs(latitude)
        let dyy = Double(daysSinceSolstice(dayOfYear: dayOfYear, year: year, latitude: latitude))
        let adjustment = seasonal(a, b, c, d, dyy)
        return JS.date(sunset + JS.round(adjustment * 60.0) * 1000)
    }
}
