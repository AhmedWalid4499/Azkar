import AzkarKit
import SwiftUI

/// Everything the tracker's views read, worked out once per change of the records, the
/// settings or the clock, and handed down through the environment.
struct TrackerData {
    let records: RecordsSnapshot
    let history: TrackerHistory
    let clock: TrackerClock
    let format: TrackerFormat
    let settings: SettingsSnapshot
    let dataset: AzkarDataset
    /// The bedtime session is listed when the dataset has it or it was ever read.
    let showsSleep: Bool
    /// The prayers whose after-prayer azkar are tracked: those the dataset has azkar for, and
    /// any read after before (a session with a record is always shown).
    let afterPrayers: [Prayer]
    let hasAnyRecord: Bool
    let quran: QuranProgress

    init(records: RecordsSnapshot, clock: TrackerClock, format: TrackerFormat, settings: SettingsSnapshot, dataset: AzkarDataset) {
        self.records = records
        self.clock = clock
        self.format = format
        self.settings = settings
        self.dataset = dataset
        let history = TrackerHistory(
            prayers: records.prayers,
            sessions: records.sessions,
            tasbih: records.tasbih.mapValues { counts in counts.sorted { $0.key < $1.key }.map { $0.value.record(preset: $0.key) } },
            fasts: records.fasts,
            quran: records.quran,
            seasons: records.seasons
        )
        self.history = history
        let sessionsRead = Set(records.sessions.values.flatMap(\.keys))
        showsSleep = dataset.availableCollections.contains(.sleep) || sessionsRead.contains(.sleep)
        let available = Set(dataset.availableAfterPrayers)
        afterPrayers = Prayer.allCases.filter { available.contains($0) || sessionsRead.contains(.afterPrayer($0)) }
        hasAnyRecord = TrackerStats.hasAnyRecord(history, today: clock.today)
        quran = QuranProgress(entries: records.quran)
    }

    var today: DayKey { clock.today }

    /// The sessions shown for a day: the daily two, bedtime when tracked, then after each prayer.
    var trackedSessions: [AzkarSession] {
        var sessions: [AzkarSession] = [.morning, .evening]
        if showsSleep { sessions.append(.sleep) }
        return sessions + afterPrayers.map(AzkarSession.afterPrayer)
    }

    func day(_ day: DayKey) -> DayRecords { records.day(day) }

    /// Fasts kept to the end over the last `days` days, today included.
    func fastsKept(days: Int) -> Int {
        let start = today.adding(days: -(days - 1))
        return history.fasts.filter { $0.key >= start && $0.key <= today && $0.value.status == .fasted }.count
    }

    var fasting: FastingStatistics {
        FastingStats.statistics(history.fasts, today: today, offset: settings.app.hijriOffset, owedBefore: records.owedFastsBefore)
    }
}

/// Where the tracker's navigation goes.
enum TrackerRoute: Hashable {
    case day(DayKey)
    case missed
    case area(TrackerArea)
    case ramadanNights(Int)
    case yearReview
}

/// The tracker's four areas, each with a page of its own.
enum TrackerArea: Hashable {
    case prayers, azkar, quran, fasting, ramadan
}
