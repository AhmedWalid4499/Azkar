import Foundation

/// One ayah's place in the Qur'an: its surah and its number in it.
public struct AyahRef: Hashable, Comparable, Sendable, CustomStringConvertible {
    public var sura: Int
    public var ayah: Int

    public init(sura: Int, ayah: Int) {
        self.sura = sura
        self.ayah = ayah
    }

    /// "2:255".
    public var description: String { "\(sura):\(ayah)" }

    public static func < (lhs: AyahRef, rhs: AyahRef) -> Bool { (lhs.sura, lhs.ayah) < (rhs.sura, rhs.ayah) }
}

/// Consecutive ayat of one surah.
public struct AyahSpan: Hashable, Sendable, Identifiable {
    public var sura: Int
    public var from: Int
    public var to: Int

    public init(sura: Int, from: Int, to: Int) {
        self.sura = sura
        self.from = from
        self.to = to
    }

    public var count: Int { to - from + 1 }
    public var isWholeSura: Bool { from == 1 && to == QuranLayout.ayahCount(of: sura) }
    public var id: String { "\(sura):\(from)-\(to)" }
}

/// How the ayat are counted and the juz divide them, from Tanzil's `quran-data.xml` (the table was
/// printed from that file by script, and a test of AzkarContent checks it against the file). Kept here
/// so the memorisation log can work in ayat without the mushaf's text.
public enum QuranLayout {
    public static let suraCount = 114
    public static let ayahTotal = 6236

    /// By surah, 1 first.
    public static let ayahCounts: [Int] = [
        7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111, 110, 98, 135, 112, 78, 118, 64, 77, 227, 93, 88, 69, 60,
        34, 30, 73, 54, 45, 83, 182, 88, 75, 85, 54, 53, 89, 59, 37, 35, 38, 29, 18, 45, 60, 49, 62, 55, 78, 96, 29, 22, 24, 13, 14, 11, 11, 18,
        12, 12, 30, 52, 52, 44, 28, 28, 20, 56, 40, 31, 50, 40, 46, 42, 29, 19, 36, 25, 22, 17, 19, 26, 30, 20, 15, 21, 11, 8, 8, 19, 5, 8, 8,
        11, 11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6,
    ]

    /// Where each juz begins, 1 first.
    public static let juzStarts: [AyahRef] = [
        (1, 1), (2, 142), (2, 253), (3, 93), (4, 24), (4, 148), (5, 82), (6, 111), (7, 88), (8, 41), (9, 93), (11, 6), (12, 53), (15, 1),
        (17, 1), (18, 75), (21, 1), (23, 1), (25, 21), (27, 56), (29, 46), (33, 31), (36, 28), (39, 32), (41, 47), (46, 1), (51, 31), (58, 1),
        (67, 1), (78, 1),
    ].map { AyahRef(sura: $0.0, ayah: $0.1) }

    /// The index in the whole Qur'an (0 for 1:1) of each surah's first ayah.
    private static let suraStarts: [Int] = {
        var starts: [Int] = []
        var total = 0
        for count in ayahCounts {
            starts.append(total)
            total += count
        }
        return starts
    }()

    /// 0 for a surah that does not exist.
    public static func ayahCount(of sura: Int) -> Int {
        (1...suraCount).contains(sura) ? ayahCounts[sura - 1] : 0
    }

    public static func contains(_ ref: AyahRef) -> Bool {
        (1...ayahCount(of: ref.sura)).contains(ref.ayah)
    }

    /// The ayah's index in the whole Qur'an, 0 for 1:1. The ref must exist.
    public static func index(_ ref: AyahRef) -> Int { suraStarts[ref.sura - 1] + ref.ayah - 1 }

    public static func index(sura: Int, ayah: Int) -> Int { suraStarts[sura - 1] + ayah - 1 }

    /// The ayah at an index of the whole Qur'an.
    public static func ref(at index: Int) -> AyahRef {
        var low = 0, high = suraStarts.count - 1
        while low < high {
            let middle = (low + high + 1) / 2
            if suraStarts[middle] <= index { low = middle } else { high = middle - 1 }
        }
        return AyahRef(sura: low + 1, ayah: index - suraStarts[low] + 1)
    }

    /// The indexes of a surah's ayat.
    public static func indexes(ofSura sura: Int) -> ClosedRange<Int> {
        suraStarts[sura - 1]...(suraStarts[sura - 1] + ayahCounts[sura - 1] - 1)
    }

    /// The indexes of a juz's ayat.
    public static func indexes(ofJuz juz: Int) -> ClosedRange<Int> {
        let start = index(juzStarts[juz - 1])
        let end = juz < juzStarts.count ? index(juzStarts[juz]) - 1 : ayahTotal - 1
        return start...end
    }

    /// The juz an ayah is in.
    public static func juz(of index: Int) -> Int {
        (juzStarts.lastIndex { Self.index($0) <= index } ?? 0) + 1
    }

    /// Indexes cut into runs of consecutive ayat of one surah each, in mushaf order.
    public static func spans(_ indexes: some Sequence<Int>) -> [AyahSpan] {
        var spans: [AyahSpan] = []
        for index in Set(indexes).sorted() {
            let ref = ref(at: index)
            if var last = spans.last, last.sura == ref.sura, last.to + 1 == ref.ayah {
                last.to = ref.ayah
                spans[spans.count - 1] = last
            } else {
                spans.append(AyahSpan(sura: ref.sura, from: ref.ayah, to: ref.ayah))
            }
        }
        return spans
    }
}
