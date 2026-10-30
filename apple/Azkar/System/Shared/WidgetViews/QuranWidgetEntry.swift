import AzkarKit
import Foundation
import WidgetKit

/// What the Quran widget shows at one moment.
nonisolated struct QuranWidgetEntry: TimelineEntry {
    let date: Date
    let language: SystemLanguage
    let quran: QuranGlance
    /// Set from the eve of Ramadan to its last day.
    let ramadan: RamadanGlance?
}

extension QuranWidgetEntry {
    /// A filled-in entry for the widget gallery and previews: page 121, and the night of 6 Ramadan
    /// with `inRamadan`, its tarawih prayed at the masjid.
    nonisolated static func sample(now: Date = .now, language: SystemLanguage = SystemLanguage(code: Bundle.main.preferredLocalizations.first ?? "en"), inRamadan: Bool = false) -> QuranWidgetEntry {
        let night = RamadanCalendar.nights(hijriYear: 1448)[5]
        let today = inRamadan ? night.evening : DayKey(now, in: .current)
        let log = [
            QuranEntry(day: today.adding(days: -1), at: now.addingTimeInterval(-86_400), kind: .read, fromPage: 0, toPage: 112),
            QuranEntry(day: today, at: now, kind: .read, fromPage: 112, toPage: 120),
        ]
        let tarawih = SeasonRecord(deed: .tarawih, day: today, at: now, place: .masjid)
        return QuranWidgetEntry(
            date: now, language: language, quran: QuranGlance(entries: log, today: today),
            ramadan: inRamadan ? RamadanGlance(today: today, beforeDawn: false, offset: 0, goal: 1, quran: log, tarawih: tarawih) : nil
        )
    }
}
