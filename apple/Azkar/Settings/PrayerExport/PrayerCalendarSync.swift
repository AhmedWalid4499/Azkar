import AzkarKit
import EventKit
import Foundation

/// What was last put in the Calendar: the app's own calendar, every event it made there and the
/// days they cover. Kept on this iPhone only (calendar and event identifiers mean nothing on
/// another device), so it is not part of the backup.
nonisolated struct PrayerCalendarRecord: Codable, Hashable, Sendable {
    var calendarID: String
    var eventIDs: [String]
    var first: DayKey
    var last: DayKey

    private static let key = "prayerCalendar.record.v1"

    static func load(from defaults: UserDefaults = .standard) -> PrayerCalendarRecord? {
        defaults.data(forKey: key).flatMap { try? JSONDecoder().decode(PrayerCalendarRecord.self, from: $0) }
    }

    static func save(_ record: PrayerCalendarRecord?, to defaults: UserDefaults = .standard) {
        if let record, let data = try? JSONEncoder().encode(record) {
            defaults.set(data, forKey: key)
        } else {
            defaults.removeObject(forKey: key)
        }
    }
}

/// The events to write, worked out from the settings before EventKit is touched.
nonisolated struct PrayerCalendarPlan: Sendable {
    struct Item: Sendable {
        var title: String
        var start: Date
    }

    /// The new calendar's name, in the interface language.
    var calendarTitle: String
    var timeZone: TimeZone
    var notes: String
    var first: DayKey
    var last: DayKey
    var items: [Item]

    /// Each prayer becomes a short event; sunrise is not a prayer and polar days skip times that
    /// cannot be calculated.
    static func make(days: [PrayerDay], title: (Prayer) -> String, calendarTitle: String, notes: String) -> PrayerCalendarPlan? {
        guard let first = days.first, let last = days.last else { return nil }
        let items = days.flatMap { day in
            Prayer.allCases.compactMap { prayer in day[prayer: prayer].map { Item(title: title(prayer), start: $0) } }
        }
        return PrayerCalendarPlan(calendarTitle: calendarTitle, timeZone: first.timeZone, notes: notes,
                                  first: first.day, last: last.day, items: items)
    }
}

/// Puts prayer times in a calendar of the app's own and takes them out again.
///
/// Full access is asked for, not write-only: with write-only access EventKit lets an app save new
/// events into the user's default calendar and nothing more. It cannot create a calendar, and it
/// cannot look up or delete an event, even one it saved itself, so adding again could only
/// duplicate and removing would be impossible. Nothing is read beyond the app's own calendar.
actor PrayerCalendarSync {
    static let shared = PrayerCalendarSync()

    /// Each prayer's event runs this long from its time.
    static let eventLength: TimeInterval = 15 * 60

    enum Failure: Error {
        case denied
        case noSource
    }

    private let store = EKEventStore()

    nonisolated static var isAuthorized: Bool { EKEventStore.authorizationStatus(for: .event) == .fullAccess }

    /// Asks once; afterwards answers from the setting the person chose.
    func requestAccess() async throws {
        switch EKEventStore.authorizationStatus(for: .event) {
        case .fullAccess: return
        case .notDetermined, .writeOnly:
            guard try await store.requestFullAccessToEvents() else { throw Failure.denied }
        default: throw Failure.denied
        }
    }

    /// The record, or `nil` once the calendar has gone (deleted in the Calendar app, say).
    func currentRecord() -> PrayerCalendarRecord? {
        guard let record = PrayerCalendarRecord.load() else { return nil }
        guard Self.isAuthorized else { return record }
        store.refreshSourcesIfNecessary()
        if store.calendar(withIdentifier: record.calendarID) == nil {
            PrayerCalendarRecord.save(nil)
            return nil
        }
        return record
    }

    /// Writes the plan, first taking out whatever was added before, so adding again replaces.
    func add(_ plan: PrayerCalendarPlan) async throws -> PrayerCalendarRecord {
        try await requestAccess()
        let previous = PrayerCalendarRecord.load()
        let calendar = try ownCalendar(previous: previous, title: plan.calendarTitle)
        do {
            if let previous { try removeEvents(of: previous, in: calendar) }
            var saved: [EKEvent] = []
            saved.reserveCapacity(plan.items.count)
            for item in plan.items {
                let event = EKEvent(eventStore: store)
                event.calendar = calendar
                event.title = item.title
                event.startDate = item.start
                event.endDate = item.start.addingTimeInterval(Self.eventLength)
                event.timeZone = plan.timeZone
                event.availability = .free
                event.notes = plan.notes
                try store.save(event, span: .thisEvent, commit: false)
                saved.append(event)
            }
            try store.commit()
            let record = PrayerCalendarRecord(calendarID: calendar.calendarIdentifier, eventIDs: saved.compactMap(\.eventIdentifier), first: plan.first, last: plan.last)
            PrayerCalendarRecord.save(record)
            return record
        } catch {
            store.reset()
            throw error
        }
    }

    /// Takes out every event the app added, then the calendar itself.
    func remove() async throws {
        try await requestAccess()
        guard let record = PrayerCalendarRecord.load() else { return }
        if let calendar = store.calendar(withIdentifier: record.calendarID) {
            do {
                try removeEvents(of: record, in: calendar)
                try store.commit()
                try store.removeCalendar(calendar, commit: true)
            } catch {
                store.reset()
                throw error
            }
        }
        PrayerCalendarRecord.save(nil)
    }

    #if DEBUG
    /// For `-PrayerExportDebug`: the calendars with the app's calendar name, and the events in the
    /// app's calendar over the recorded days.
    func debugSummary(title: String) -> String {
        let sameName = store.calendars(for: .event).filter { $0.title == title }.count
        guard let record = PrayerCalendarRecord.load(), let calendar = store.calendar(withIdentifier: record.calendarID) else {
            return "no record or calendar; calendars named \(title): \(sameName)"
        }
        let predicate = store.predicateForEvents(withStart: record.first.adding(days: -1).noonUTC, end: record.last.adding(days: 2).noonUTC, calendars: [calendar])
        let events = store.events(matching: predicate)
        let first = events.min { $0.startDate < $1.startDate }
        return "calendars named \(title): \(sameName), recorded ids \(record.eventIDs.count), events in calendar \(events.count), "
            + "days \(record.first)…\(record.last), first \(first?.title ?? "-") \(first?.startDate.description ?? "-") source \(calendar.source.title)"
    }
    #endif

    // MARK: -

    /// The calendar made last time, or a new one in the account new events go to (iCloud on most
    /// iPhones), falling back to one kept on the iPhone.
    private func ownCalendar(previous: PrayerCalendarRecord?, title: String) throws -> EKCalendar {
        if let id = previous?.calendarID, let calendar = store.calendar(withIdentifier: id) { return calendar }
        var sources: [EKSource] = []
        if let source = store.defaultCalendarForNewEvents?.source { sources.append(source) }
        sources += store.sources.filter { $0.sourceType == .calDAV && $0.title == "iCloud" }
        sources += store.sources.filter { $0.sourceType == .local }
        var lastError: Error = Failure.noSource
        for source in sources {
            let calendar = EKCalendar(for: .event, eventStore: store)
            calendar.title = title
            calendar.source = source
            calendar.cgColor = Self.color
            do {
                try store.saveCalendar(calendar, commit: true)
                return calendar
            } catch {
                lastError = error
            }
        }
        throw lastError
    }

    /// Deletes the recorded events, and anything else left in the app's calendar over the same
    /// days (an identifier can change when the calendar syncs), without committing.
    private func removeEvents(of record: PrayerCalendarRecord, in calendar: EKCalendar) throws {
        var removed = Set<String>()
        for id in record.eventIDs {
            guard let event = store.event(withIdentifier: id), event.calendar?.calendarIdentifier == calendar.calendarIdentifier else { continue }
            try store.remove(event, span: .thisEvent, commit: false)
            removed.insert(id)
        }
        let start = record.first.adding(days: -1).noonUTC
        let end = record.last.adding(days: 2).noonUTC
        let predicate = store.predicateForEvents(withStart: start, end: end, calendars: [calendar])
        for event in store.events(matching: predicate) where !removed.contains(event.eventIdentifier ?? "") {
            try store.remove(event, span: .thisEvent, commit: false)
        }
    }

    /// The app's green.
    private static let color = CGColor(srgbRed: 0x0E / 255, green: 0x6B / 255, blue: 0x54 / 255, alpha: 1)
}
