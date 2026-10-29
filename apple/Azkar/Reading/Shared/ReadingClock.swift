import AzkarKit
import Foundation

/// Where the day stands for the azkar at one instant: the calendar day at the saved place, the
/// part of the day from its prayer times (fixed hours when no place is saved), the session the
/// clock recommends, and the day each session's reading is filed under.
struct ReadingClock: Equatable {
    let today: DayKey
    let phase: DayPhase

    init(now: Date, settings: SettingsSnapshot) {
        let timeZone = settings.timeZone
        let today = DayKey(now, in: timeZone)
        self.today = today
        let prayerDay = settings.location.flatMap(PrayerPlace.init).map {
            PrayerCalculator.day(today, at: $0, config: settings.calculation)
        }
        phase = DayPhase(at: now, in: timeZone, prayerDay: prayerDay)
    }

    /// Night sessions read before Fajr continue the previous day's.
    func day(for session: AzkarSession) -> DayKey {
        phase.sessionDay(for: session, today: today)
    }

    /// The tasbih counter files a count as the evening is: until Fajr, under the day before.
    var tasbihDay: DayKey {
        TasbihStats.openDay(today: today, beforeDawn: phase == .beforeDawn)
    }

    var recommendedSession: AzkarSession? { phase.recommendedSession }
}
