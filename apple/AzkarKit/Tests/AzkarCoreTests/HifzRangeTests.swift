import AzkarCore
import Foundation
import Testing

@Suite struct HifzRangeTests {
    private let day = DayKey(year: 2026, month: 11, day: 1)!

    private func entry(_ kind: HifzEntry.Kind, _ sura: Int, _ from: Int?, _ to: Int?, _ offset: Int, strength: HifzStrength? = nil, second: Double = 0) -> HifzEntry {
        HifzEntry(sura: sura, day: day.adding(days: offset), at: Date(timeIntervalSince1970: Double(offset) * 86_400 + second), kind: kind,
                  fromAyah: from, toAyah: to, strength: strength)
    }

    @Test func theLayoutAddsUpAndFindsItsWay() {
        #expect(QuranLayout.ayahCounts.count == 114)
        #expect(QuranLayout.ayahCounts.reduce(0, +) == QuranLayout.ayahTotal)
        #expect(QuranLayout.index(sura: 2, ayah: 1) == 7)
        #expect(QuranLayout.ref(at: 7) == AyahRef(sura: 2, ayah: 1))
        #expect(QuranLayout.ref(at: QuranLayout.ayahTotal - 1) == AyahRef(sura: 114, ayah: 6))
        #expect(QuranLayout.indexes(ofJuz: 30).count == 564)
        #expect(QuranLayout.indexes(ofJuz: 1) == 0...(QuranLayout.index(sura: 2, ayah: 141)))
        #expect(QuranLayout.juz(of: QuranLayout.index(sura: 2, ayah: 142)) == 2)
        #expect(QuranLayout.spans([7, 8, 9, 0, 1, 6]) == [AyahSpan(sura: 1, from: 1, to: 2), AyahSpan(sura: 1, from: 7, to: 7), AyahSpan(sura: 2, from: 1, to: 3)])
    }

    @Test func aRangeIsValidOnlyInsideItsSurah() {
        #expect(HifzEntry.isValid(sura: 2, fromAyah: nil, toAyah: nil))
        #expect(HifzEntry.isValid(sura: 2, fromAyah: 1, toAyah: 286))
        #expect(!HifzEntry.isValid(sura: 2, fromAyah: 1, toAyah: 287))
        #expect(!HifzEntry.isValid(sura: 2, fromAyah: 5, toAyah: 4))
        #expect(!HifzEntry.isValid(sura: 2, fromAyah: 5, toAyah: nil))
        #expect(!HifzEntry.isValid(sura: 0, fromAyah: nil, toAyah: nil))
        #expect(HifzEntry(span: AyahSpan(sura: 112, from: 1, to: 4), day: day, at: .now, kind: .memorised).isWholeSura)
    }

    @Test func partsAddUpToAWholeSurah() throws {
        var log = [entry(.memorised, 2, 1, 143, 0)]
        var progress = HifzProgress(entries: log)
        let baqarah = try #require(progress.suras[2])
        #expect(baqarah.heldAyat == 143 && !baqarah.isComplete)
        #expect(progress.memorisedCount == 0 && progress.partialCount == 1)
        log.append(entry(.memorised, 2, 144, 286, 1))
        progress = HifzProgress(entries: log)
        #expect(progress.memorisedCount == 1 && progress.heldAyat == 286)
        #expect(progress.suras[2]?.memorisedOn == day)
    }

    @Test func forgettingPartLeavesTheRest() {
        let progress = HifzProgress(entries: [entry(.memorised, 67, nil, nil, 0), entry(.forgotten, 67, 1, 10, 1)])
        #expect(progress.suras[67]?.heldAyat == 20)
        #expect(progress.state(sura: 67, ayah: 10) == nil)
        #expect(progress.state(sura: 67, ayah: 11) != nil)
        #expect(progress.portions.map(\.span) == [AyahSpan(sura: 67, from: 11, to: 30)])
    }

    @Test func aReviewOfWhatIsNotHeldChangesNothingButCounts() {
        let progress = HifzProgress(entries: [entry(.reviewed, 2, 1, 5, 0, strength: .strong)])
        #expect(progress.suras.isEmpty && progress.totalReviews == 1)
    }

    @Test func theScheduleClimbsWithGoodReviewsAndFallsWithAWeakOne() throws {
        #expect(HifzSchedule.step(after: .weak, from: 5) == 0)
        #expect(HifzSchedule.step(after: .good, from: 0) == 1)
        #expect(HifzSchedule.step(after: nil, from: 0) == 1)
        #expect(HifzSchedule.step(after: .strong, from: 0) == 2)
        #expect(HifzSchedule.step(after: .strong, from: 7) == 7)

        // Memorised: due the next day. Strong on day 1: due four days on. Weak on day 5: the next day again.
        var log = [entry(.memorised, 2, 1, 143, 0)]
        #expect(HifzProgress(entries: log).portions.first?.dueOn == day.adding(days: 1))
        log.append(entry(.reviewed, 2, 1, 143, 1, strength: .strong))
        #expect(HifzProgress(entries: log).portions.first?.dueOn == day.adding(days: 5))
        #expect(HifzProgress(entries: log).due(on: day.adding(days: 4)).isEmpty)
        log.append(entry(.reviewed, 2, 1, 143, 5, strength: .weak))
        let progress = HifzProgress(entries: log)
        let portion = try #require(progress.portions.first)
        #expect(portion.strength == .weak && portion.dueOn == day.adding(days: 6) && portion.reviews == 2)
        #expect(progress.due(on: day.adding(days: 6)).map(\.span) == [AyahSpan(sura: 2, from: 1, to: 143)])
        #expect(progress.nextDue(from: day.adding(days: 5)) == day.adding(days: 6))
    }

    @Test func portionsSplitWhereTheReviewsDifferAndTheMostOverdueComesFirst() {
        let progress = HifzProgress(entries: [
            entry(.memorised, 2, 1, 20, 0),
            entry(.memorised, 114, nil, nil, 0, second: 1),
            entry(.reviewed, 2, 11, 20, 2, strength: .strong),
        ])
        #expect(progress.portions.map(\.span) == [AyahSpan(sura: 2, from: 1, to: 10), AyahSpan(sura: 2, from: 11, to: 20), AyahSpan(sura: 114, from: 1, to: 6)])
        #expect(progress.due(on: day.adding(days: 3)).map(\.span) == [AyahSpan(sura: 2, from: 1, to: 10), AyahSpan(sura: 114, from: 1, to: 6)])
        // The surah's last review is its oldest ayah's.
        #expect(progress.suras[2]?.lastReviewedOn == day)
    }

    @Test func targetsAreStoredAndReadBack() {
        let targets: [HifzPlan.Target] = [.sura(2), .juz(30), .range(from: AyahRef(sura: 2, ayah: 1), to: AyahRef(sura: 3, ayah: 10))]
        for target in targets { #expect(HifzPlan.Target(storage: target.storage) == target) }
        #expect(HifzPlan.Target(storage: "juz:31") == nil)
        #expect(HifzPlan.Target(storage: "range:3:10-2:1") == nil)
        #expect(HifzPlan.Target(storage: "page:3") == nil)
        #expect(HifzPlan.Target.range(from: AyahRef(sura: 2, ayah: 1), to: AyahRef(sura: 3, ayah: 10)).indexes.count == 296)
    }

    @Test func aPlanShowsTodaysPortionAndHowFarAheadOrBehind() {
        // Al-Mulk (30 ayat) in ten days from day 0, three a day.
        let plan = HifzPlan(createdAt: .now, start: day, target: .sura(67), targetDay: day.adding(days: 9), dailyAyat: 3)
        #expect(HifzPlan.dailyAyat(for: .sura(67), from: day, to: day.adding(days: 9), progress: HifzProgress(entries: [])) == 3)

        var standing = HifzPlanStanding(plan: plan, progress: HifzProgress(entries: []), entries: [], today: day)
        #expect(standing.todayPortion == [AyahSpan(sura: 67, from: 1, to: 3)])
        #expect(standing.balance == 0 && !standing.isTodayDone && standing.daysLeft == 10)

        // Day 2 with nothing done: two days behind.
        standing = HifzPlanStanding(plan: plan, progress: HifzProgress(entries: []), entries: [], today: day.adding(days: 2))
        #expect(standing.balance == -6 && standing.todayPortion == [AyahSpan(sura: 67, from: 1, to: 3)])

        // Day 2 with 1-9 memorised on day 0 and 10-11 today: ahead until today's goal, then today counts.
        let log = [entry(.memorised, 67, 1, 9, 0), entry(.memorised, 67, 10, 11, 2)]
        standing = HifzPlanStanding(plan: plan, progress: HifzProgress(entries: log), entries: log, today: day.adding(days: 2))
        #expect(standing.doneToday == 2 && standing.todayGoal == 3)
        #expect(standing.todayPortion == [AyahSpan(sura: 67, from: 12, to: 12)])
        #expect(standing.balance == 11 - 6)
        let done = log + [entry(.memorised, 67, 12, 14, 2, second: 1)]
        standing = HifzPlanStanding(plan: plan, progress: HifzProgress(entries: done), entries: done, today: day.adding(days: 2))
        #expect(standing.isTodayDone && standing.todayPortion.isEmpty && standing.balance == 14 - 9)
        #expect(standing.neededPerDay == 2)
    }

    @Test func aPlanAcrossSurahsSkipsWhatIsHeldAndFinishes() {
        let plan = HifzPlan(createdAt: .now, start: day, target: .range(from: AyahRef(sura: 112, ayah: 1), to: AyahRef(sura: 114, ayah: 6)), targetDay: day.adding(days: 2), dailyAyat: 6)
        let log = [entry(.memorised, 113, nil, nil, 0)]
        var standing = HifzPlanStanding(plan: plan, progress: HifzProgress(entries: log), entries: [], today: day.adding(days: 1))
        #expect(standing.total == 15 && standing.held == 5)
        #expect(standing.todayPortion == [AyahSpan(sura: 112, from: 1, to: 4), AyahSpan(sura: 114, from: 1, to: 2)])
        let all = log + [entry(.memorised, 112, nil, nil, 1), entry(.memorised, 114, nil, nil, 1)]
        standing = HifzPlanStanding(plan: plan, progress: HifzProgress(entries: all), entries: all, today: day.adding(days: 1))
        #expect(standing.isComplete && standing.left == 0 && standing.neededPerDay == 0)
    }

    @Test func entriesWrittenBeforeRangesStillDecode() throws {
        let old = #"{"id":"E621E1F8-C36C-495A-93FC-0C247A3E6E5F","sura":67,"day":"2026-11-01","at":0,"kind":"memorised"}"#
        let entry = try JSONDecoder().decode(HifzEntry.self, from: Data(old.utf8))
        #expect(entry.isWholeSura && entry.strength == nil && entry.span == AyahSpan(sura: 67, from: 1, to: 30))
    }
}
