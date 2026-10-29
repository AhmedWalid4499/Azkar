import AzkarCore
import Foundation

/// Prayer times on the device: a port of the website's `computePrayerDay`
/// (src/features/prayer-times/engine/compute.ts), minute for minute.
public enum PrayerCalculator {
    /// Below this latitude the sun rises and sets every day of the year.
    static let polarLatitude = 65.0
    /// How far a borrowed latitude moves toward the equator at a time; adhan's own step.
    static let latitudeStep = 0.5
    /// Under this noon altitude Asr is worked out here instead of by adhan, which is already five
    /// minutes off at 6° and ten at 3°. Ordinary latitudes never get this low (London's midwinter noon is 15°).
    static let lowSunDegrees = 10.0
    private static let minuteMs = 60_000.0

    /// Whether the sun can stay up, or down, all day somewhere at this latitude.
    public static func isPolarLatitude(_ latitude: Double) -> Bool { abs(latitude) >= polarLatitude }

    /// The six times of one civil day at a place, whatever zone the device is in.
    public static func day(_ day: DayKey, at place: PrayerPlace, config: CalculationConfig) -> PrayerDay {
        let times = instants(day, at: place, config: config)
        var dates: [TimeSlot: Date] = [:]
        for slot in TimeSlot.allCases {
            if let date = JS.toDate(times[slot]) { dates[slot] = date }
        }
        return PrayerDay(day: day, timeZone: place.timeZone, times: dates)
    }

    /// `count` consecutive days from `first`.
    public static func days(from first: DayKey, count: Int, at place: PrayerPlace, config: CalculationConfig) -> [PrayerDay] {
        (0..<max(0, count)).map { day(first.adding(days: $0), at: place, config: config) }
    }

    static func clamp(_ minutes: Int) -> Int { min(Adjustments.limit, max(-Adjustments.limit, minutes)) }

    static func instants(_ dayKey: DayKey, at place: PrayerPlace, config: CalculationConfig) -> AdhanDay {
        let resolved = config.resolved(at: place)
        var userAdjustments = MinuteOffsets()
        userAdjustments.fajr = clamp(config.adjustments.fajr)
        userAdjustments.sunrise = clamp(config.adjustments.sunrise)
        userAdjustments.dhuhr = clamp(config.adjustments.dhuhr)
        userAdjustments.asr = clamp(config.adjustments.asr)
        userAdjustments.maghrib = clamp(config.adjustments.maghrib)
        userAdjustments.isha = clamp(config.adjustments.isha)

        var parameters = AdhanParameters(
            method: MethodParameters(resolved.method),
            madhab: resolved.madhab,
            highLatitudeRule: resolved.highLatitudeRule,
            adjustments: userAdjustments
        )
        // The Umm al-Qura calendar holds Isha two hours after Maghrib in Ramadan instead of ninety
        // minutes; adhan leaves that to the caller.
        if resolved.method == .ummAlQura, UmmAlQura.isRamadan(dayKey) { parameters.adjustments.isha += 30 }

        /// adhan's answer for a civil day at a latitude on this place's meridian.
        func adhanDay(_ latitude: Double, _ key: DayKey) -> AdhanDay {
            let computed = AdhanDay(day: key, latitude: latitude, longitude: place.longitude, parameters: parameters)
            // adhan anchors each solar day to the UTC date. Where the clock and the sun disagree across the
            // date line (Kiritimati, Tonga, Samoa: UTC+13/+14 at western longitudes) that is the neighbouring
            // local day, so ask again for the day whose noon really falls on `key` here.
            if let dhuhr = JS.toDate(computed.dhuhr) {
                let landedOn = DayKey(dhuhr, in: place.timeZone)
                if landedOn != key {
                    return AdhanDay(day: key.adding(days: landedOn.days(to: key)), latitude: latitude, longitude: place.longitude, parameters: parameters)
                }
            }
            return computed
        }

        func timesAt(_ latitude: Double) -> AdhanDay {
            var times = adhanDay(latitude, dayKey)
            guard JS.isValid(times.dhuhr) else { return times }
            // Dhuhr is the transit plus the method's and the user's minutes, rounded: close enough to find the transit from.
            let transit = LowSun.transit(near: times.dhuhr - Double(parameters.offset(.dhuhr)) * minuteMs, longitude: place.longitude)
            if LowSun.altitude(at: transit, latitude: latitude, longitude: place.longitude) < lowSunDegrees {
                let asr = LowSun.asr(transit: transit, latitude: latitude, longitude: place.longitude, shadowFactor: parameters.madhab == .hanafi ? 2 : 1)
                // What adhan does to its own Asr: the method's and the user's minutes, then rounding.
                times.asr = roundToMinute(asr + Double(parameters.offset(.asr)) * minuteMs, parameters.method.rounding)
            }
            return times
        }

        // Whole: every time exists, Asr is in its afternoon, and the night ends. The user's own minutes
        // are left out of this: fine-tuning must not decide which latitude is borrowed.
        func isWholeDay(_ times: AdhanDay, _ latitude: Double) -> Bool {
            TimeSlot.allCases.allSatisfy { JS.isValid(times[$0]) }
                && isAsrInOrder(times, shift: userAdjustments)
                && JS.isValid(adhanDay(latitude, dayKey.adding(days: 1)).sunrise)
        }

        var times = timesAt(place.latitude)
        if config.polar == .nearestLatitude {
            var latitude = place.latitude
            var borrowed = times
            var whole = isWholeDay(borrowed, latitude)
            while !whole, abs(latitude) >= polarLatitude {
                latitude -= sign(latitude) * latitudeStep
                borrowed = timesAt(latitude)
                whole = isWholeDay(borrowed, latitude)
            }
            if whole { times = borrowed }
        }

        // Whatever produced it, an Asr outside its own afternoon is not shown and nobody is reminded of it.
        if !isAsrInOrder(times, shift: MinuteOffsets()) { times.asr = JS.invalid }
        return times
    }

    /// `Math.sign` for a finite latitude.
    private static func sign(_ value: Double) -> Double { value > 0 ? 1 : (value < 0 ? -1 : 0) }

    /// Whether Asr falls strictly between Dhuhr and Maghrib, after taking `shift` minutes off each.
    /// On a day without a sunset (midnight sun) there is no Maghrib to stay ahead of.
    static func isAsrInOrder(_ times: AdhanDay, shift: MinuteOffsets) -> Bool {
        func at(_ slot: TimeSlot) -> Double { times[slot] - Double(shift[slot]) * minuteMs }
        guard JS.isValid(times.asr), JS.isValid(times.dhuhr), !(at(.asr) <= at(.dhuhr)) else { return false }
        return !JS.isValid(times.maghrib) || at(.asr) < at(.maghrib)
    }

    /// adhan's rounding of a time to the minute, for a time that was worked out here.
    static func roundToMinute(_ instant: Double, _ rounding: TimeRounding) -> Instant {
        // adhan drops the fraction of a second before it looks at the seconds.
        let whole = (instant / 1000).rounded(.down)
        let seconds = (whole.truncatingRemainder(dividingBy: 60) + 60).truncatingRemainder(dividingBy: 60)
        var offset = seconds >= 30 ? 60 - seconds : -seconds
        switch rounding {
        case .up: offset = 60 - seconds
        case .none: offset = 0
        case .nearest: break
        }
        return JS.date((whole + offset) * 1000)
    }
}
