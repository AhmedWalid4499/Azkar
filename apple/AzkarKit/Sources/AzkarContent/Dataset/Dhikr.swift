import AzkarCore
import Foundation

// The dataset's records, as `src/features/azkar/data/schema.ts` defines them. Decoding is
// tolerant of fields it does not know, so a newer dataset still loads.

/// An inclusive ayah range, used to verify Qur'anic text against a canonical source.
public struct QuranRef: Codable, Hashable, Sendable {
    public var surah: Int
    public var from: Int
    public var to: Int

    public init(surah: Int, from: Int, to: Int) {
        self.surah = surah
        self.from = from
        self.to = to
    }
}

/// How a dhikr of the after-prayer list applies to each prayer.
public struct AfterPrayerRule: Hashable, Sendable {
    /// The prayers it is said after; `nil` means all five.
    public var prayers: [Prayer]?
    /// Repetitions after particular prayers, overriding the dhikr's `repeat` for those.
    public var repeatCounts: [Prayer: Int]
    /// The narration for its place after the prayer, when it differs from the dhikr's own
    /// (Ayat al-Kursi after every prayer is narrated apart from the morning one).
    public var narration: Narration?

    /// A reference, virtue or note that replaces the dhikr's own after the prayers.
    public struct Narration: Hashable, Sendable, Codable {
        public var reference: BilingualText?
        public var virtue: BilingualText?
        public var note: BilingualText?

        public init(reference: BilingualText? = nil, virtue: BilingualText? = nil, note: BilingualText? = nil) {
            self.reference = reference
            self.virtue = virtue
            self.note = note
        }
    }

    public init(prayers: [Prayer]? = nil, repeatCounts: [Prayer: Int] = [:], narration: Narration? = nil) {
        self.prayers = prayers
        self.repeatCounts = repeatCounts
        self.narration = narration
    }

    /// Whether the dhikr is said after `prayer`.
    public func applies(to prayer: Prayer) -> Bool {
        prayers?.contains(prayer) ?? true
    }
}

extension AfterPrayerRule: Codable {
    private enum CodingKeys: String, CodingKey {
        case prayers, `repeat`, narration
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        // Names that are not prayers are ignored, as `includes` ignores them on the website.
        prayers = try container.decodeIfPresent([String].self, forKey: .prayers)?.compactMap(Prayer.init(rawValue:))
        let counts = try container.decodeIfPresent([String: Int].self, forKey: .repeat) ?? [:]
        repeatCounts = Dictionary(uniqueKeysWithValues: counts.compactMap { key, value in
            Prayer(rawValue: key).map { ($0, value) }
        })
        narration = try container.decodeIfPresent(Narration.self, forKey: .narration)
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encodeIfPresent(prayers?.map(\.rawValue), forKey: .prayers)
        if !repeatCounts.isEmpty {
            let counts = Dictionary(uniqueKeysWithValues: repeatCounts.map { ($0.key.rawValue, $0.value) })
            try container.encode(counts, forKey: .repeat)
        }
        try container.encodeIfPresent(narration, forKey: .narration)
    }
}

/// One dhikr of the dataset. Its Arabic text comes from the dataset only, never typed by hand.
public struct Dhikr: Codable, Hashable, Sendable, Identifiable {
    /// Stable slug. Progress is stored against it.
    public var id: String
    /// Fully vocalised Arabic text to recite.
    public var arabic: String
    public var transliteration: String?
    /// English translation of the meaning.
    public var translation: String
    /// How many times to recite it in one session (after a prayer: its count after that prayer).
    public var `repeat`: Int
    /// The source's own remark on the count when `repeat` cannot carry it.
    public var note: BilingualText?
    /// Reward or benefit mentioned in the narration, when there is one.
    public var virtue: BilingualText?
    /// Where it is narrated.
    public var reference: BilingualText
    /// Set when `arabic` contains Qur'an.
    public var quran: [QuranRef]?
    /// Only on items of the after-prayer list.
    public var afterPrayer: AfterPrayerRule?

    public init(
        id: String, arabic: String, transliteration: String? = nil, translation: String, repeat: Int,
        note: BilingualText? = nil, virtue: BilingualText? = nil, reference: BilingualText,
        quran: [QuranRef]? = nil, afterPrayer: AfterPrayerRule? = nil
    ) {
        self.id = id
        self.arabic = arabic
        self.transliteration = transliteration
        self.translation = translation
        self.repeat = `repeat`
        self.note = note
        self.virtue = virtue
        self.reference = reference
        self.quran = quran
        self.afterPrayer = afterPrayer
    }
}

/// Where the dataset's text comes from.
public struct AzkarSource: Codable, Hashable, Sendable {
    public var name: String
    public var url: String
    public var license: String
    /// What this source was used for, e.g. "Arabic text and counts".
    public var usedFor: String

    public init(name: String, url: String, license: String, usedFor: String) {
        self.name = name
        self.url = url
        self.license = license
        self.usedFor = usedFor
    }
}
