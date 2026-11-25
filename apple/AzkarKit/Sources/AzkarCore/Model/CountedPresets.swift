import Foundation

// Counters kept with the tasbih counter's records (one row a day each, kept for good, with the
// time of the last count) that are not presets of the tasbih counter itself. Their keys cannot
// clash with a dataset id, a custom dhikr ("custom-…") or the free count.

extension TasbihRecord {
    /// A dua for an occasion: "occasion-<chapter>-<entry>", an item of the occasions dataset.
    public static let occasionPrefix = "occasion-"
    /// The takbir of the Eid and of the days of Dhul Hijjah.
    public static let takbir = "takbir"

    public static func isOccasion(_ preset: String) -> Bool {
        preset.hasPrefix(occasionPrefix) && preset.count > occasionPrefix.count
    }

    /// Whether the store keeps a counter for `preset` that is not one of the tasbih presets.
    public static func isOtherCounter(_ preset: String) -> Bool {
        isOccasion(preset) || preset == takbir || HajjLap(rawValue: preset) != nil
    }

    public var isOccasion: Bool { Self.isOccasion(preset) }

    /// Whether `preset` is a count of dhikr on the tasbih counter (the takbir included), not a
    /// dua for an occasion or a lap of tawaf or sa'i.
    public static func isTasbih(_ preset: String) -> Bool {
        !isOccasion(preset) && HajjLap(rawValue: preset) == nil
    }

    public var isTasbih: Bool { Self.isTasbih(preset) }
}

/// The laps of the Hajj and Umrah mode's counters: seven of tawaf round the Ka'bah, seven of sa'i
/// between as-Safa and al-Marwah. Kept with the tasbih counter's records under these keys.
public enum HajjLap: String, CaseIterable, Sendable {
    case tawaf
    case sai

    /// Laps in one tawaf or one sa'i.
    public static let laps = 7
}
