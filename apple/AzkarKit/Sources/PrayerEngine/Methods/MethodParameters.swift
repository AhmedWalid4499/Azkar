import AzkarCore
import Foundation

/// How a computed time is brought to the minute.
enum TimeRounding: Sendable {
    case nearest
    case up
    case none
}

/// The parameters behind a preset, as adhan-js 4.4.6 defines them (lib/esm/CalculationMethod.js).
/// adhan-swift 1.5.0 has the same values, but keeps the method's own minutes internal.
struct MethodParameters: Sendable {
    var method: CalculationMethodID
    var fajrAngle: Double
    var ishaAngle: Double
    /// Minutes after Maghrib; when positive it replaces `ishaAngle`.
    var ishaInterval: Double = 0
    /// Only Tehran's: Maghrib when the sun is this far below the horizon.
    var maghribAngle: Double = 0
    /// Minutes the method itself adds to each time.
    var methodAdjustments = MinuteOffsets()
    var rounding: TimeRounding = .nearest

    init(_ method: CalculationMethodID) {
        self.method = method
        switch method {
        case .muslimWorldLeague:
            fajrAngle = 18; ishaAngle = 17
            methodAdjustments.dhuhr = 1
        case .egyptian:
            fajrAngle = 19.5; ishaAngle = 17.5
            methodAdjustments.dhuhr = 1
        case .karachi:
            fajrAngle = 18; ishaAngle = 18
            methodAdjustments.dhuhr = 1
        case .ummAlQura:
            fajrAngle = 18.5; ishaAngle = 0; ishaInterval = 90
        case .dubai:
            fajrAngle = 18.2; ishaAngle = 18.2
            methodAdjustments = MinuteOffsets(sunrise: -3, dhuhr: 3, asr: 3, maghrib: 3)
        case .moonsightingCommittee:
            fajrAngle = 18; ishaAngle = 18
            methodAdjustments = MinuteOffsets(dhuhr: 5, maghrib: 3)
        case .northAmerica:
            fajrAngle = 15; ishaAngle = 15
            methodAdjustments.dhuhr = 1
        case .kuwait:
            fajrAngle = 18; ishaAngle = 17.5
        case .qatar:
            fajrAngle = 18; ishaAngle = 0; ishaInterval = 90
        case .singapore:
            fajrAngle = 20; ishaAngle = 18
            methodAdjustments.dhuhr = 1
            rounding = .up
        case .tehran:
            fajrAngle = 17.7; ishaAngle = 14; maghribAngle = 4.5
        case .turkey:
            fajrAngle = 18; ishaAngle = 17
            methodAdjustments = MinuteOffsets(sunrise: -7, dhuhr: 5, asr: 4, maghrib: 7)
        }
    }
}

/// Whole minutes per time slot, unclamped (the Umm al-Qura Ramadan half hour rides on top of the user's own).
struct MinuteOffsets: Sendable {
    var fajr = 0
    var sunrise = 0
    var dhuhr = 0
    var asr = 0
    var maghrib = 0
    var isha = 0

    init(fajr: Int = 0, sunrise: Int = 0, dhuhr: Int = 0, asr: Int = 0, maghrib: Int = 0, isha: Int = 0) {
        self.fajr = fajr
        self.sunrise = sunrise
        self.dhuhr = dhuhr
        self.asr = asr
        self.maghrib = maghrib
        self.isha = isha
    }

    subscript(slot: TimeSlot) -> Int {
        switch slot {
        case .fajr: fajr
        case .sunrise: sunrise
        case .dhuhr: dhuhr
        case .asr: asr
        case .maghrib: maghrib
        case .isha: isha
        }
    }
}

/// The twilight parameters behind a preset, for explaining it in Settings.
public struct MethodAngles: Hashable, Sendable {
    public let fajrAngle: Double
    public let ishaAngle: Double
    /// Minutes after Maghrib; when positive it replaces `ishaAngle`.
    public let ishaInterval: Double
}

extension CalculationMethodID {
    /// The method's Fajr and Isha angles, or Isha's fixed interval after Maghrib.
    public var angles: MethodAngles {
        let parameters = MethodParameters(self)
        return MethodAngles(fajrAngle: parameters.fajrAngle, ishaAngle: parameters.ishaAngle, ishaInterval: parameters.ishaInterval)
    }
}
