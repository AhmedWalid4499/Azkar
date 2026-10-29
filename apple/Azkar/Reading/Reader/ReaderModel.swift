import AzkarKit
import Foundation
import Observation
import SwiftUI

/// One reading of a session on one day: which dhikr shows, the counter's taps, auto-advance,
/// and the tap lock after a dhikr completes. As the website's `Reader.tsx`.
///
/// Every count goes through `RecordsModel.count`, in tap order. The counter shows a tap at once
/// (`pending`), before the store has saved it, so fast tapping never waits on the store.
@MainActor
@Observable
final class ReaderModel {
    /// How long the "done" state shows before the reader moves on by itself.
    static let advanceDelay: Duration = .milliseconds(500)
    /// After a dhikr completes, taps are ignored this long (on top of the advance delay), so a
    /// thumb still tapping out a count does not skip ahead or start on the next dhikr.
    static let settle: Duration = .milliseconds(400)
    /// From this many repetitions, "Mark all done" is offered.
    static let markAllFrom = 10

    let session: AzkarSession
    let day: DayKey
    let items: [Dhikr]
    private let context: ReadingContext

    /// The dhikr on screen, as the pager's scroll position.
    var page: Int? = 0
    /// The calm screen at the end of the session.
    var isComplete = false
    var isOverviewShown = false
    /// Bumped for the light haptic of a count, and the success haptic of a completed dhikr.
    private(set) var ticks = 0
    private(set) var completions = 0

    /// Count changes shown but not yet saved, by dhikr id.
    private var pending: [String: Int] = [:]
    @ObservationIgnored private var lockedUntil = ContinuousClock.now
    @ObservationIgnored private var advanceTask: Task<Void, Never>?
    @ObservationIgnored private var writes: Task<Void, Never>?
    /// The page auto-advance moved to, which keeps the tap lock (a swipe lifts it).
    @ObservationIgnored private var advancedTo: Int?

    init(session: AzkarSession, day: DayKey, context: ReadingContext) {
        self.session = session
        self.day = day
        self.context = context
        items = context.dataset.azkar(for: session)
        resumeIfLoaded()
    }

    /// Whether the reader has found where to start (it waits for the records to load when opened
    /// from a deep link at launch).
    @ObservationIgnored private var hasResumed = false

    /// Resumes where the session was left, the first dhikr still short of its count, once the
    /// records are loaded; the completion screen when every dhikr is done.
    func resumeIfLoaded() {
        guard !hasResumed, context.records.isLoaded else { return }
        hasResumed = true
        if let first = ReadingProgress.firstUnfinished(items, savedCounts) {
            page = first
            isComplete = false
        } else {
            page = 0
            isComplete = !items.isEmpty
        }
        #if DEBUG
        if let start = ReadingDebug.startPage, items.indices.contains(start) {
            page = start
            isComplete = false
        }
        #endif
    }

    var index: Int { min(max(page ?? 0, 0), max(items.count - 1, 0)) }
    var current: Dhikr? { items.indices.contains(index) ? items[index] : nil }

    private var savedCounts: [String: Int] { context.day(day).counts[session] ?? [:] }

    /// The counts as shown: what is saved plus the taps on their way.
    var counts: [String: Int] {
        var counts = savedCounts
        for (id, change) in pending { counts[id, default: 0] += change }
        return counts
    }

    func count(of dhikr: Dhikr) -> Int { ReadingProgress.count(of: dhikr, in: counts) }

    var doneCount: Int { items.filter { ReadingProgress.isDone($0, in: counts) }.count }

    var isSessionDone: Bool { !items.isEmpty && doneCount == items.count }

    /// 0…1 with partial credit, for the progress bar.
    var fraction: Double {
        guard !items.isEmpty else { return 0 }
        let credit = items.reduce(0.0) { $0 + Double(count(of: $1)) / Double(ReadingProgress.target(of: $1)) }
        return credit / Double(items.count)
    }

    // MARK: Counting

    /// The big counter: one more, or, once the dhikr is done, on to the next.
    func primary(settings: ReaderSettings, reduceMotion: Bool, announce: (Dhikr, Int) -> Void) {
        guard let dhikr = current, ContinuousClock.now >= lockedUntil else { return }
        let target = ReadingProgress.target(of: dhikr)
        let before = count(of: dhikr)
        if before >= target {
            advance(from: index, reduceMotion: reduceMotion)
            return
        }
        write(.increment, dhikr, change: 1)
        if before + 1 >= target {
            completed(dhikr, at: index, settings: settings, reduceMotion: reduceMotion, announce: announce)
        } else {
            ticks += 1
        }
    }

    func undo() {
        guard let dhikr = current, count(of: dhikr) > 0 else { return }
        cancelAdvance()
        lockedUntil = .now
        write(.decrement, dhikr, change: -1)
        ticks += 1
    }

    func markAllDone(settings: ReaderSettings, reduceMotion: Bool, announce: (Dhikr, Int) -> Void) {
        guard let dhikr = current else { return }
        let missing = ReadingProgress.target(of: dhikr) - count(of: dhikr)
        guard missing > 0 else { return }
        write(.complete, dhikr, change: missing)
        completed(dhikr, at: index, settings: settings, reduceMotion: reduceMotion, announce: announce)
    }

    private func completed(_ dhikr: Dhikr, at position: Int, settings: ReaderSettings, reduceMotion: Bool, announce: (Dhikr, Int) -> Void) {
        completions += 1
        announce(dhikr, position)
        lockedUntil = .now + Self.settle + (settings.autoAdvance ? Self.advanceDelay : .zero)
        guard settings.autoAdvance else { return }
        cancelAdvance()
        if reduceMotion {
            advance(from: position, reduceMotion: true)
        } else {
            advanceTask = Task { [weak self] in
                try? await Task.sleep(for: Self.advanceDelay)
                guard !Task.isCancelled else { return }
                self?.advance(from: position, reduceMotion: false)
            }
        }
    }

    /// Saves a change after the ones before it, showing it meanwhile.
    private func write(_ step: CountStep, _ dhikr: Dhikr, change: Int) {
        pending[dhikr.id, default: 0] += change
        let previous = writes
        let records = context.records
        let session = session, day = day, id = dhikr.id
        writes = Task { [weak self] in
            await previous?.value
            _ = try? await records.count(step, dhikr: id, in: session, on: day)
            guard let self else { return }
            let left = (pending[id] ?? 0) - change
            pending[id] = left == 0 ? nil : left
        }
    }

    // MARK: Moving

    /// Past the dhikr at `from`: to the next unfinished one, or the end of the session.
    func advance(from position: Int, reduceMotion: Bool) {
        cancelAdvance()
        if let next = ReadingProgress.nextUnfinished(items, counts, after: position) {
            advancedTo = next
            withAnimation(reduceMotion ? nil : .smooth) { page = next }
        } else {
            withAnimation(reduceMotion ? nil : .smooth) { isComplete = true }
        }
    }

    func go(to position: Int, reduceMotion: Bool) {
        guard items.indices.contains(position) else { return }
        withAnimation(reduceMotion ? nil : .smooth) { page = position }
        pageChanged()
    }

    /// A swipe or a jump: whatever was about to happen to the previous dhikr no longer does.
    func pageChanged() {
        if page == advancedTo {
            advancedTo = nil
            return
        }
        cancelAdvance()
        lockedUntil = .now
    }

    func startOver() {
        cancelAdvance()
        lockedUntil = .now
        let previous = writes
        let records = context.records
        let session = session, day = day
        writes = Task {
            await previous?.value
            _ = try? await records.startOver(session, on: day)
        }
        isOverviewShown = false
        page = 0
        isComplete = false
    }

    func review() {
        page = 0
        isComplete = false
    }

    func cancelAdvance() {
        advanceTask?.cancel()
        advanceTask = nil
    }
}
