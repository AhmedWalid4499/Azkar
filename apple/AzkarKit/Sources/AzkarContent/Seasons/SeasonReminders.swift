import AzkarCore
import Foundation

/// Which of the fasting, Ramadan, Friday and sunnah reminders fall on a day. The times come from
/// the prayers of that day (`ReminderPlan`).
public enum SeasonReminders {
    /// The page Surah al-Kahf begins on in the Medina Mushaf.
    public static let kahfPage = 293

    /// What `day` holds: after its Isha, a reminder of tomorrow's fast; in Ramadan, suhoor before
    /// its Fajr and iftar before its Maghrib; and, on the evening of an odd night of the last ten,
    /// that night. Tomorrow's fast is told once, by its most particular reason, and never in
    /// Ramadan or for a day fasting is not permitted, which have no reasons.
    ///
    /// Friday brings Surah al-Kahf after sunrise, and every day Duha and Witr unless `isDone` says
    /// they are already ticked for that day.
    public static func plan(for day: DayKey, choices: SeasonReminderChoices, offset: Int = 0,
                            isDone: (SunnahPrayer, DayKey) -> Bool = { _, _ in false }) -> [SeasonReminder] {
        var reminders: [SeasonReminder] = []
        let tomorrow = FastingCalendar.info(for: day.adding(days: 1), offset: offset)
        if let reason = tomorrow.reasons.first(where: { choices.wants($0) }) {
            reminders.append(SeasonReminder(kind: .fast(reason), anchor: .isha))
        }
        if HijriCalendar.isRamadan(day, offset: offset) {
            if choices.suhoor {
                reminders.append(SeasonReminder(kind: .suhoor, anchor: .fajr, offsetMinutes: -choices.suhoorLeadMinutes))
            }
            if choices.iftar {
                reminders.append(SeasonReminder(kind: .iftar, anchor: .maghrib, offsetMinutes: -SeasonReminderChoices.iftarLeadMinutes))
            }
        }
        if choices.oddNights, let night = RamadanCalendar.night(onEvening: day, offset: offset), night.isLastTen, night.isOdd {
            reminders.append(SeasonReminder(kind: .oddNight(night.number), anchor: .isha))
        }
        if choices.kahf, day.isFriday {
            reminders.append(SeasonReminder(kind: .kahf, anchor: .sunrise, offsetMinutes: SeasonReminderChoices.kahfDelayMinutes))
        }
        if choices.duha, !isDone(.duha, day) {
            reminders.append(SeasonReminder(kind: .duha, anchor: .sunrise, offsetMinutes: SeasonReminderChoices.duhaDelayMinutes))
        }
        if choices.witr, !isDone(.witr, day) {
            reminders.append(SeasonReminder(kind: .witr, anchor: .isha, offsetMinutes: choices.witrDelayMinutes))
        }
        return reminders
    }
}

private extension SeasonReminderChoices {
    func wants(_ reason: FastingReason) -> Bool {
        switch reason {
        case .arafah, .ashura, .tasua: occasions
        case .whiteDays: whiteDays
        case .monday, .thursday: mondayThursday
        // The six of Shawwal can fall on any of its days: a reminder would come every evening.
        case .shawwal: false
        }
    }
}
