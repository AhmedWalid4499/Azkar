import AzkarCore
import Foundation

/// Everything adhan is asked with, besides the place and the day.
struct AdhanParameters: Sendable {
    var method: MethodParameters
    var madhab: Madhab
    var highLatitudeRule: HighLatitudeRuleID
    /// The user's minutes (and Umm al-Qura's Ramadan half hour).
    var adjustments: MinuteOffsets

    var nightPortions: (fajr: Double, isha: Double) {
        switch highLatitudeRule {
        case .middleOfTheNight: (1.0 / 2, 1.0 / 2)
        case .seventhOfTheNight: (1.0 / 7, 1.0 / 7)
        case .twilightAngle: (method.fajrAngle / 60, method.ishaAngle / 60)
        }
    }

    /// The method's and the user's minutes together.
    func offset(_ slot: TimeSlot) -> Int { adjustments[slot] + method.methodAdjustments[slot] }
}

/// The six times as adhan-js 4.4.6 computes them, with its polar-circle resolution left "unresolved":
/// a time that does not exist is NaN on its own, and the rest of the day still comes out.
///
/// This is a port of `PrayerTimes` in node_modules/adhan/lib/esm/PrayerTimes.js rather than a call to
/// adhan-swift's, which gives up on the whole day when any one time is missing (losing Dhuhr and Asr
/// under the midnight sun, or Fajr in the polar night) and keeps the method's own minutes internal.
struct AdhanDay {
    var fajr: Instant
    var sunrise: Instant
    var dhuhr: Instant
    var asr: Instant
    var maghrib: Instant
    var isha: Instant

    subscript(slot: TimeSlot) -> Instant {
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
            switch slot {
            case .fajr: fajr = newValue
            case .sunrise: sunrise = newValue
            case .dhuhr: dhuhr = newValue
            case .asr: asr = newValue
            case .maghrib: maghrib = newValue
            case .isha: isha = newValue
            }
        }
    }

    /// The civil day `day` at `latitude`, `longitude` (adhan reads the day's year, month and date and nothing else).
    init(day: DayKey, latitude: Double, longitude: Double, parameters: AdhanParameters) {
        let method = parameters.method
        let (year, month, date) = (day.year, day.month, day.day)
        let tomorrow = day.adding(days: 1)
        let solarTime = SolarTime(year: year, month: month, day: date, latitude: latitude, longitude: longitude)
        let tomorrowSolarTime = SolarTime(year: tomorrow.year, month: tomorrow.month, day: tomorrow.day, latitude: latitude, longitude: longitude)
        let onDay = { (hours: Double) in TimeComponents.utc(hours, year: year, month: month, day: date) }

        let dhuhrTime = onDay(solarTime.transit)
        let sunriseTime = onDay(solarTime.sunrise)
        let sunsetTime = onDay(solarTime.sunset)
        let asrTime = onDay(solarTime.afternoon(shadowLength: parameters.madhab == .hanafi ? 2 : 1))
        let tomorrowSunrise = TimeComponents.utc(tomorrowSolarTime.sunrise, year: tomorrow.year, month: tomorrow.month, day: tomorrow.day)
        let night = (tomorrowSunrise - sunsetTime) / 1000
        let dayOfYear = JS.daysFromCivil(year: year, month: month, day: date) - JS.daysFromCivil(year: year, month: 1, day: 1) + 1
        let moonsightingAbove55 = method.method == .moonsightingCommittee && latitude >= 55

        var fajrTime = onDay(solarTime.hourAngle(-1 * method.fajrAngle, afterTransit: false))
        if moonsightingAbove55 {
            fajrTime = JS.date(sunriseTime + -(night / 7) * 1000)
        }
        let safeFajr: Instant = method.method == .moonsightingCommittee
            ? Astro.seasonAdjustedMorningTwilight(latitude: latitude, dayOfYear: dayOfYear, year: year, sunrise: sunriseTime)
            : JS.date(sunriseTime + -(parameters.nightPortions.fajr * night) * 1000)
        // NaN compares false, as in JavaScript.
        if fajrTime.isNaN || safeFajr > fajrTime {
            fajrTime = safeFajr
        }

        var ishaTime: Instant
        if method.ishaInterval > 0 {
            ishaTime = JS.date(sunsetTime + method.ishaInterval * 60 * 1000)
        } else {
            ishaTime = onDay(solarTime.hourAngle(-1 * method.ishaAngle, afterTransit: true))
            if moonsightingAbove55 {
                ishaTime = JS.date(sunsetTime + (night / 7) * 1000)
            }
            let safeIsha: Instant = method.method == .moonsightingCommittee
                ? Astro.seasonAdjustedEveningTwilight(latitude: latitude, dayOfYear: dayOfYear, year: year, sunset: sunsetTime)
                : JS.date(sunsetTime + parameters.nightPortions.isha * night * 1000)
            if ishaTime.isNaN || safeIsha < ishaTime {
                ishaTime = safeIsha
            }
        }

        var maghribTime = sunsetTime
        if method.maghribAngle != 0 {
            let angleBased = onDay(solarTime.hourAngle(-1 * method.maghribAngle, afterTransit: true))
            if sunsetTime < angleBased, ishaTime > angleBased {
                maghribTime = angleBased
            }
        }

        func finish(_ instant: Instant, _ slot: TimeSlot) -> Instant {
            Self.roundedMinute(JS.date(instant + Double(parameters.offset(slot)) * 60 * 1000), method.rounding)
        }
        fajr = finish(fajrTime, .fajr)
        sunrise = finish(sunriseTime, .sunrise)
        dhuhr = finish(dhuhrTime, .dhuhr)
        asr = finish(asrTime, .asr)
        maghrib = finish(maghribTime, .maghrib)
        isha = finish(ishaTime, .isha)
    }

    /// adhan-js's `roundedMinute`: looks at the whole seconds only, so a fraction of a second survives it.
    static func roundedMinute(_ instant: Instant, _ rounding: TimeRounding) -> Instant {
        let seconds = JS.utcSeconds(instant)
        var offset = seconds >= 30 ? 60 - seconds : -1 * seconds
        switch rounding {
        case .up: offset = 60 - seconds
        case .none: offset = 0
        case .nearest: break
        }
        return JS.date(instant + offset * 1000)
    }
}
