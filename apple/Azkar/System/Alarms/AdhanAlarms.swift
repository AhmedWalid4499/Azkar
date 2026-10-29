import AlarmKit
import AppIntents
import AzkarKit
import Foundation
import SwiftUI

/// What an adhan alarm carries.
nonisolated struct AdhanMetadata: AlarmMetadata {
    var prayer: Prayer
    var day: DayKey
}

/// The adhan as an alarm (AlarmKit) at the times of the prayers chosen in Settings: it sounds through
/// silent mode and Focus. Alarms are set for `windowDays` days ahead and renewed whenever the app
/// runs (launch, foreground, background refresh), so they keep coming; each alarm's id is derived
/// from its day and prayer, so scheduling again only changes what moved.
enum AdhanAlarms {
    /// Days ahead: up to 15 alarms, well within what the system lets an app keep.
    static let windowDays = 3

    nonisolated struct Planned: Hashable, Sendable {
        let id: UUID
        let prayer: Prayer
        let day: DayKey
        let at: Date
    }

    /// Sets the alarms the settings ask for and cancels the rest. Does nothing without permission.
    static func reschedule(settings: SettingsSnapshot, now: Date = .now) async {
        let manager = AlarmManager.shared
        guard manager.authorizationState == .authorized else { return }
        let wanted = plan(settings: settings, now: now)
        let existing = (try? manager.alarms) ?? []
        let wantedByID = Dictionary(uniqueKeysWithValues: wanted.map { ($0.id, $0) })

        var kept = Set<UUID>()
        for alarm in existing {
            if let planned = wantedByID[alarm.id], case let .fixed(date)? = alarm.schedule, abs(date.timeIntervalSince(planned.at)) < 1 {
                kept.insert(alarm.id)
            } else if alarm.state != .alerting {
                // Not wanted any more, or its time moved (a new place or method): set again below.
                try? manager.cancel(id: alarm.id)
            }
        }
        let language = SystemLanguage(settings.app)
        for planned in wanted where !kept.contains(planned.id) {
            do {
                try await set(planned, language)
            } catch AlarmManager.AlarmError.maximumLimitReached {
                print("Azkar: the system's alarm limit is reached; the rest of the adhan alarms wait for the next renewal")
                break
            } catch {
                print("Azkar: setting the adhan alarm for \(planned.prayer) failed: \(error)")
            }
        }
    }

    /// Cancels every adhan alarm.
    static func cancelAll() {
        for alarm in (try? AlarmManager.shared.alarms) ?? [] {
            try? AlarmManager.shared.cancel(id: alarm.id)
        }
    }

    static func plan(settings: SettingsSnapshot, now: Date) -> [Planned] {
        let chosen = settings.reminders.adhan
        guard !chosen.isEmpty, let location = settings.location, let place = PrayerPlace(location) else { return [] }
        let today = DayKey(now, in: place.timeZone)
        let days = PrayerCalculator.days(from: today.adding(days: -1), count: windowDays + 2, at: place, config: settings.calculation)
        let until = now.addingTimeInterval(TimeInterval(windowDays * 86_400))
        return PrayerTimeline(days: days).entries
            .filter { chosen.contains($0.prayer) && $0.at > now && $0.at <= until }
            .map { Planned(id: alarmID(day: $0.day, prayer: $0.prayer), prayer: $0.prayer, day: $0.day, at: $0.at) }
    }

    /// The same id for the same prayer of the same day, however often it is scheduled.
    nonisolated static func alarmID(day: DayKey, prayer: Prayer) -> UUID {
        let digit = Prayer.allCases.firstIndex(of: prayer) ?? 0
        let number = (day.year * 10_000 + day.month * 100 + day.day) * 10 + digit
        return UUID(uuidString: String(format: "AD4A0000-0000-4000-8000-%012d", number))!
    }

    private nonisolated static func set(_ planned: Planned, _ language: SystemLanguage) async throws {
        _ = try await AlarmManager.shared.schedule(id: planned.id, configuration: configuration(planned, language))
    }

    private nonisolated static func configuration(_ planned: Planned, _ language: SystemLanguage) -> AlarmManager.AlarmConfiguration<AdhanMetadata> {
        let name = SystemText.prayer(planned.prayer, language)
        let title = SystemText.format("It’s time for %@", language, name)
        let open = AlarmButton(text: verbatim(SystemText.string("Open", language)), textColor: .white, systemImageName: "arrow.up.forward.app")
        let presentation = AlarmPresentation(alert: AlarmPresentation.Alert(title: verbatim(title), secondaryButton: open, secondaryButtonBehavior: .custom))
        let attributes = AlarmAttributes(presentation: presentation, metadata: AdhanMetadata(prayer: planned.prayer, day: planned.day), tintColor: .azkarAccent)
        return .alarm(schedule: .fixed(planned.at), attributes: attributes, secondaryIntent: OpenTodayLiveIntent())
    }

    /// Text already in the interface language, shown as it is.
    private nonisolated static func verbatim(_ text: String) -> LocalizedStringResource {
        LocalizedStringResource(String.LocalizationValue(stringLiteral: text), table: "AdhanVerbatim")
    }
}

/// The alarm's "Open" button: brings Azkar forward at Today.
struct OpenTodayLiveIntent: LiveActivityIntent {
    static let title = LocalizedStringResource("Open Today", table: "System")
    static let isDiscoverable = false
    static let supportedModes: IntentModes = .foreground(.immediate)

    init() {}

    func perform() async throws -> some IntentResult {
        await MainActor.run { SystemRouter.shared.go(.today) }
        return .result()
    }
}
