import Foundation

/// How a review went.
public enum HifzStrength: Int, Codable, CaseIterable, Comparable, Sendable {
    /// Many slips: it comes back the next day.
    case weak = 1
    /// A few slips.
    case good = 2
    /// Without a slip.
    case strong = 3

    public static func < (lhs: HifzStrength, rhs: HifzStrength) -> Bool { lhs.rawValue < rhs.rawValue }
}

/// One thing recorded about memorising a surah, or some ayat of it. The log is the only source of
/// truth and only ever grows, so what was memorised and reviewed, and when, is kept even after a
/// surah slips away.
public struct HifzEntry: Codable, Hashable, Sendable, Identifiable {
    public enum Kind: String, Codable, Sendable {
        case memorised
        case reviewed
        /// No longer held by heart: it goes back to not memorised, its history stays.
        case forgotten
    }

    public var id: UUID
    /// 1...114.
    public var sura: Int
    public var day: DayKey
    public var at: Date
    public var kind: Kind
    /// The first and last ayah it is about; both `nil` for the whole surah.
    public var fromAyah: Int?
    public var toAyah: Int?
    /// How a review went; `nil` for what is not a review, and for reviews logged before it was asked.
    public var strength: HifzStrength?

    public init(id: UUID = UUID(), sura: Int, day: DayKey, at: Date, kind: Kind, fromAyah: Int? = nil, toAyah: Int? = nil, strength: HifzStrength? = nil) {
        self.id = id
        self.sura = sura
        self.day = day
        self.at = at
        self.kind = kind
        self.fromAyah = fromAyah
        self.toAyah = toAyah
        self.strength = strength
    }

    /// An entry about `span`: the whole surah is stored without a range, as entries were before ranges.
    public init(id: UUID = UUID(), span: AyahSpan, day: DayKey, at: Date, kind: Kind, strength: HifzStrength? = nil) {
        let whole = span.isWholeSura
        self.init(id: id, sura: span.sura, day: day, at: at, kind: kind, fromAyah: whole ? nil : span.from, toAyah: whole ? nil : span.to, strength: strength)
    }

    public var isWholeSura: Bool { fromAyah == nil && toAyah == nil }

    /// The ayat it is about, kept within the surah.
    public var span: AyahSpan {
        let count = QuranLayout.ayahCount(of: sura)
        let from = min(max(fromAyah ?? 1, 1), count)
        let to = min(max(toAyah ?? count, from), count)
        return AyahSpan(sura: sura, from: from, to: to)
    }

    /// Whether a surah and range make an entry: a surah that exists and, when given, a range inside it.
    public static func isValid(sura: Int, fromAyah: Int?, toAyah: Int?) -> Bool {
        let count = QuranLayout.ayahCount(of: sura)
        guard count > 0 else { return false }
        switch (fromAyah, toAyah) {
        case (nil, nil): return true
        case let (from?, to?): return 1 <= from && from <= to && to <= count
        default: return false
        }
    }
}

/// When held ayat are due again: a ladder of intervals climbed by good reviews and left by a weak one.
public enum HifzSchedule {
    /// Days from the last review (or from memorising) to the next, by step.
    public static let intervals = [1, 2, 4, 7, 14, 30, 60, 120]

    /// The step after a review: back to the bottom after a weak one, one up after a good one (or one
    /// logged before strength was asked), two up after a strong one.
    public static func step(after strength: HifzStrength?, from step: Int) -> Int {
        let top = intervals.count - 1
        switch strength {
        case .weak: return 0
        case .good, nil: return min(step + 1, top)
        case .strong: return min(step + 2, top)
        }
    }

    public static func dueOn(lastReviewedOn: DayKey, step: Int) -> DayKey {
        lastReviewedOn.adding(days: intervals[min(max(step, 0), intervals.count - 1)])
    }
}

/// Everything derived from the memorisation log.
public struct HifzProgress: Hashable, Sendable {
    public static let suraCount = QuranLayout.suraCount

    /// Where one held ayah stands.
    public struct AyahState: Hashable, Sendable {
        public var memorisedOn: DayKey
        /// The day of the latest review; the day it was memorised until there is one.
        public var lastReviewedOn: DayKey
        /// How the latest review went; `nil` before the first, or for one logged without it.
        public var strength: HifzStrength?
        /// Where it is on `HifzSchedule.intervals`.
        public var step: Int
        public var reviews: Int

        public var dueOn: DayKey { HifzSchedule.dueOn(lastReviewedOn: lastReviewedOn, step: step) }
    }

    /// A surah with any ayat held by heart now.
    public struct Sura: Hashable, Sendable, Identifiable {
        public var number: Int
        /// The first day any of what is held was memorised.
        public var memorisedOn: DayKey
        /// The day of the review longest ago among what is held: the day it was memorised until there is one.
        public var lastReviewedOn: DayKey
        /// Reviews logged of it since any of it was last held from nothing.
        public var reviews: Int
        public var heldAyat: Int
        public var ayahCount: Int

        public var id: Int { number }
        public var isComplete: Bool { heldAyat == ayahCount }
    }

    /// Consecutive held ayat of one surah that stand alike: reviewed the same day, as well, and due the same day.
    public struct Portion: Hashable, Sendable, Identifiable {
        public var span: AyahSpan
        public var memorisedOn: DayKey
        public var lastReviewedOn: DayKey
        public var strength: HifzStrength?
        public var step: Int
        public var reviews: Int

        public var id: String { span.id }
        public var dueOn: DayKey { HifzSchedule.dueOn(lastReviewedOn: lastReviewedOn, step: step) }
        public func isDue(on today: DayKey) -> Bool { dueOn <= today }
    }

    /// Held ayat by surah, `nil` for an ayah not held (index 0 is ayah 1).
    private var held: [Int: [AyahState?]] = [:]
    private var reviewsBySura: [Int: Int] = [:]
    /// By surah number.
    public private(set) var suras: [Int: Sura] = [:]
    /// Reviews ever logged, of surahs forgotten since included.
    public private(set) var totalReviews = 0
    /// Ayat ever logged as memorised, counted again when memorised again.
    public private(set) var totalMemorisedAyat = 0

    /// `entries` in any order: they are sorted by `at`, and those of one instant keep their order.
    public init(entries: [HifzEntry]) {
        let ordered = entries.enumerated().sorted { ($0.element.at, $0.offset) < ($1.element.at, $1.offset) }
        for (_, entry) in ordered {
            let count = QuranLayout.ayahCount(of: entry.sura)
            guard count > 0 else { continue }
            let span = entry.span
            var states = held[entry.sura] ?? Array(repeating: nil, count: count)
            if !states.contains(where: { $0 != nil }) { reviewsBySura[entry.sura] = 0 }
            switch entry.kind {
            case .memorised:
                totalMemorisedAyat += span.count
                for ayah in span.from...span.to {
                    states[ayah - 1] = AyahState(memorisedOn: entry.day, lastReviewedOn: entry.day, strength: nil, step: 0, reviews: 0)
                }
            case .reviewed:
                totalReviews += 1
                var touched = false
                for ayah in span.from...span.to {
                    guard var state = states[ayah - 1] else { continue }
                    touched = true
                    state.step = HifzSchedule.step(after: entry.strength, from: state.step)
                    state.strength = entry.strength
                    state.lastReviewedOn = max(state.lastReviewedOn, entry.day)
                    state.reviews += 1
                    states[ayah - 1] = state
                }
                if touched { reviewsBySura[entry.sura, default: 0] += 1 }
            case .forgotten:
                for ayah in span.from...span.to { states[ayah - 1] = nil }
            }
            held[entry.sura] = states.contains { $0 != nil } ? states : nil
        }
        for (number, states) in held {
            let kept = states.compactMap { $0 }
            guard let first = kept.map(\.memorisedOn).min(), let oldest = kept.map(\.lastReviewedOn).min() else { continue }
            suras[number] = Sura(number: number, memorisedOn: first, lastReviewedOn: oldest, reviews: reviewsBySura[number] ?? 0,
                                 heldAyat: kept.count, ayahCount: states.count)
        }
    }

    /// Surahs held whole.
    public var memorisedCount: Int { suras.values.filter(\.isComplete).count }
    /// Surahs held in part only.
    public var partialCount: Int { suras.values.filter { !$0.isComplete }.count }
    /// Ayat held by heart now.
    public var heldAyat: Int { suras.values.reduce(0) { $0 + $1.heldAyat } }

    /// The surahs held by heart, wholly or in part, the one reviewed longest ago first.
    public var byLastReview: [Sura] {
        suras.values.sorted { ($0.lastReviewedOn, $0.number) < ($1.lastReviewedOn, $1.number) }
    }

    /// Where an ayah stands, `nil` when it is not held.
    public func state(sura: Int, ayah: Int) -> AyahState? {
        guard let states = held[sura], (1...states.count).contains(ayah) else { return nil }
        return states[ayah - 1]
    }

    /// Where the ayah at an index of the whole Qur'an stands.
    public func state(at index: Int) -> AyahState? {
        let ref = QuranLayout.ref(at: index)
        return state(sura: ref.sura, ayah: ref.ayah)
    }

    public func isHeld(at index: Int) -> Bool { state(at: index) != nil }

    /// What is held, in mushaf order, cut where the review history differs.
    public var portions: [Portion] {
        var portions: [Portion] = []
        for sura in held.keys.sorted() {
            guard let states = held[sura] else { continue }
            for (offset, state) in states.enumerated() {
                guard let state else { continue }
                let ayah = offset + 1
                if var last = portions.last, last.span.sura == sura, last.span.to + 1 == ayah,
                   last.lastReviewedOn == state.lastReviewedOn, last.strength == state.strength, last.step == state.step {
                    last.span.to = ayah
                    last.memorisedOn = min(last.memorisedOn, state.memorisedOn)
                    last.reviews = max(last.reviews, state.reviews)
                    portions[portions.count - 1] = last
                } else {
                    portions.append(Portion(span: AyahSpan(sura: sura, from: ayah, to: ayah), memorisedOn: state.memorisedOn, lastReviewedOn: state.lastReviewedOn,
                                            strength: state.strength, step: state.step, reviews: state.reviews))
                }
            }
        }
        return portions
    }

    /// What is due for review on `today` (or overdue), the longest overdue first, then in mushaf order.
    public func due(on today: DayKey) -> [Portion] {
        portions.enumerated().filter { $0.element.isDue(on: today) }
            .sorted { ($0.element.dueOn, $0.offset) < ($1.element.dueOn, $1.offset) }.map(\.element)
    }

    /// The first day from `today` on which anything is due; `nil` when nothing is held.
    public func nextDue(from today: DayKey) -> DayKey? {
        portions.map { max($0.dueOn, today) }.min()
    }
}

/// A goal of memorising a surah, a juz or a stretch of ayat by a date, a little each day.
/// Plans are kept for good: one that is stopped or replaced is ended, never deleted.
public struct HifzPlan: Hashable, Sendable, Identifiable {
    public enum Target: Hashable, Sendable {
        case sura(Int)
        case juz(Int)
        /// From one ayah to another, across surahs if need be.
        case range(from: AyahRef, to: AyahRef)

        /// The ayat it covers, as indexes of the whole Qur'an.
        public var indexes: ClosedRange<Int> {
            switch self {
            case let .sura(sura): QuranLayout.indexes(ofSura: sura)
            case let .juz(juz): QuranLayout.indexes(ofJuz: juz)
            case let .range(from, to): QuranLayout.index(from)...QuranLayout.index(to)
            }
        }

        public var isValid: Bool {
            switch self {
            case let .sura(sura): (1...QuranLayout.suraCount).contains(sura)
            case let .juz(juz): (1...QuranLayout.juzStarts.count).contains(juz)
            case let .range(from, to): QuranLayout.contains(from) && QuranLayout.contains(to) && from <= to
            }
        }

        /// How it is stored: "sura:2", "juz:30" or "range:2:1-2:141".
        public var storage: String {
            switch self {
            case let .sura(sura): "sura:\(sura)"
            case let .juz(juz): "juz:\(juz)"
            case let .range(from, to): "range:\(from)-\(to)"
            }
        }

        public init?(storage: String) {
            let parts = storage.split(separator: ":", maxSplits: 1).map(String.init)
            guard parts.count == 2 else { return nil }
            let target: Target
            switch parts[0] {
            case "sura":
                guard let sura = Int(parts[1]) else { return nil }
                target = .sura(sura)
            case "juz":
                guard let juz = Int(parts[1]) else { return nil }
                target = .juz(juz)
            case "range":
                let ends = parts[1].split(separator: "-").map { $0.split(separator: ":").compactMap { Int($0) } }
                guard ends.count == 2, ends.allSatisfy({ $0.count == 2 }) else { return nil }
                target = .range(from: AyahRef(sura: ends[0][0], ayah: ends[0][1]), to: AyahRef(sura: ends[1][0], ayah: ends[1][1]))
            default:
                return nil
            }
            guard target.isValid else { return nil }
            self = target
        }
    }

    public static let maxDailyAyat = 1000

    public var id: UUID
    public var createdAt: Date
    /// The first day of the plan.
    public var start: DayKey
    public var target: Target
    /// The day it should be done by.
    public var targetDay: DayKey
    /// New ayat to memorise each day.
    public var dailyAyat: Int
    /// When it was stopped or replaced; `nil` while it runs.
    public var endedAt: Date?

    public init(id: UUID = UUID(), createdAt: Date, start: DayKey, target: Target, targetDay: DayKey, dailyAyat: Int, endedAt: Date? = nil) {
        self.id = id
        self.createdAt = createdAt
        self.start = start
        self.target = target
        self.targetDay = targetDay
        self.dailyAyat = dailyAyat
        self.endedAt = endedAt
    }

    /// The ayat a day it takes to memorise what is still left of `target` from `start` to `targetDay`.
    public static func dailyAyat(for target: Target, from start: DayKey, to targetDay: DayKey, progress: HifzProgress) -> Int {
        let left = target.indexes.filter { !progress.isHeld(at: $0) }.count
        let days = max(1, start.days(to: targetDay) + 1)
        return min(maxDailyAyat, max(1, Int((Double(left) / Double(days)).rounded(.up))))
    }

    public var isActive: Bool { endedAt == nil }
}

/// Where a plan stands on a day.
public struct HifzPlanStanding: Hashable, Sendable {
    /// Ayat the plan covers.
    public let total: Int
    /// Of them, held now.
    public let held: Int
    /// Of them, memorised today and held.
    public let doneToday: Int
    /// What today asks for, done or not: the daily amount, or what is left when that is less.
    public let todayGoal: Int
    /// What is left of today's portion, the next ayat not held, in mushaf order.
    public let todayPortion: [AyahSpan]
    /// Ayat ahead of the plan (negative when behind), counting today once its portion is done.
    public let balance: Int
    /// Days from today to the target day, both included; 0 once it has passed.
    public let daysLeft: Int
    /// Ayat a day that would finish what is left by the target day.
    public let neededPerDay: Int

    public var isComplete: Bool { held >= total }
    public var isTodayDone: Bool { doneToday >= todayGoal }
    public var left: Int { total - held }

    public init(plan: HifzPlan, progress: HifzProgress, entries: [HifzEntry], today: DayKey) {
        let indexes = plan.target.indexes
        total = indexes.count
        held = indexes.filter { progress.isHeld(at: $0) }.count
        var memorisedToday = Set<Int>()
        for entry in entries where entry.kind == .memorised && entry.day == today {
            let span = entry.span
            for ayah in span.from...span.to {
                let index = QuranLayout.index(sura: span.sura, ayah: ayah)
                if indexes.contains(index), progress.isHeld(at: index) { memorisedToday.insert(index) }
            }
        }
        doneToday = memorisedToday.count
        let heldBefore = held - doneToday
        todayGoal = today < plan.start ? 0 : min(plan.dailyAyat, total - heldBefore)
        let wanted = max(0, todayGoal - doneToday)
        todayPortion = QuranLayout.spans(indexes.lazy.filter { !progress.isHeld(at: $0) }.prefix(wanted))
        let elapsed = max(0, plan.start.days(to: today))
        let countsToday = today >= plan.start && doneToday >= todayGoal
        let expected = min(total, plan.dailyAyat * (elapsed + (countsToday ? 1 : 0)))
        balance = held - expected
        daysLeft = max(0, today.days(to: plan.targetDay) + 1)
        let left = total - held
        neededPerDay = left == 0 ? 0 : Int((Double(left) / Double(max(1, daysLeft))).rounded(.up))
    }
}
