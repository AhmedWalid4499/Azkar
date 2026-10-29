import Foundation

/// The live compass's arithmetic, as the website's src/features/qibla/heading.ts (branch
/// wip/web-seven-features): angles, smoothing along the shortest arc, and alignment with hysteresis.
enum QiblaMath {
    /// Within this many degrees of the Qibla the phone counts as facing it.
    static let alignEnterDegrees = 3.0
    /// Once facing it, the phone has to turn this far away before it no longer counts, so the state does not flicker.
    static let alignLeaveDegrees = 5.0
    /// Beyond this many degrees of uncertainty the compass needs calibrating.
    static let poorAccuracyDegrees = 25.0
    /// How quickly small movements are followed: long enough to still the sensor's tremor.
    static let settleSeconds = 0.15
    /// A change this large is followed at once, so a real turn does not lag.
    static let followDegrees = 24.0

    /// An angle brought into 0 ≤ angle < 360.
    static func normalized(_ angle: Double) -> Double {
        let turned = angle.truncatingRemainder(dividingBy: 360)
        return (turned < 0 ? turned + 360 : turned) + 0
    }

    /// The shortest turn from `from` to `to`, in degrees: positive is clockwise, -180 < turn ≤ 180.
    static func signedDelta(from: Double, to: Double) -> Double {
        let turn = normalized(to - from)
        return turn > 180 ? turn - 360 : turn
    }

    /// Exponential smoothing along the shortest arc, so 359° and 1° average to 0° rather than 180°.
    static func smoothed(previous: Double?, next: Double, elapsed: TimeInterval) -> Double {
        guard let previous else { return normalized(next) }
        let delta = signedDelta(from: previous, to: next)
        let byTime = 1 - exp(-max(0, elapsed) / settleSeconds)
        let bySize = min(1, abs(delta) / followDegrees)
        return normalized(previous + delta * max(byTime, bySize))
    }

    /// Alignment with hysteresis: `turn` is how far the phone still has to turn, either way.
    static func isAligned(wasAligned: Bool, turn: Double) -> Bool {
        abs(turn) <= (wasAligned ? alignLeaveDegrees : alignEnterDegrees)
    }

    /// A negative accuracy means the compass is not calibrated.
    static func isPoorAccuracy(_ accuracy: Double) -> Bool {
        accuracy < 0 || accuracy > poorAccuracyDegrees
    }
}
