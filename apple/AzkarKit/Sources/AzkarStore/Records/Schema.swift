import AzkarCore
import Foundation
import SwiftData

// The records on disk. Rows are small and flat, one per thing recorded, keyed by the day as a
// `yyyymmdd` number (range queries stay plain comparisons) and by the raw values the website
// uses. Plain values cross the actor boundary; rows never leave `RecordStore`.
//
// Evolving the schema: never change a version that has shipped. Copy the latest to a new
// `AzkarSchemaV<n>`, change the copy, point the typealiases below and `StoreContainer.open` at
// it, and add a stage to `AzkarMigrationPlan` (lightweight when SwiftData can infer it, custom
// when values must be rewritten).

enum AzkarSchemaV1: VersionedSchema {
    static let versionIdentifier = Schema.Version(1, 0, 0)

    static var models: [any PersistentModel.Type] {
        [PrayerRow.self, SunnahRow.self, SessionRow.self, DhikrCountRow.self, TallyRow.self, TasbihRow.self, FastRow.self, ImportRow.self]
    }

    /// One obligatory prayer's status on one day.
    @Model final class PrayerRow {
        #Unique<PrayerRow>([\.day, \.prayer])
        #Index<PrayerRow>([\.day])
        var day: Int
        var prayer: String
        var status: String
        var loggedAt: Date?

        init(day: Int, prayer: String, status: String, loggedAt: Date?) {
            self.day = day
            self.prayer = prayer
            self.status = status
            self.loggedAt = loggedAt
        }
    }

    /// One sunnah prayer ticked on one day.
    @Model final class SunnahRow {
        #Unique<SunnahRow>([\.day, \.sunnah])
        #Index<SunnahRow>([\.day])
        var day: Int
        var sunnah: String
        var at: Date

        init(day: Int, sunnah: String, at: Date) {
            self.day = day
            self.sunnah = sunnah
            self.at = at
        }
    }

    /// One azkar session's record on one day (`AzkarSession.description` as the key).
    @Model final class SessionRow {
        #Unique<SessionRow>([\.day, \.session])
        #Index<SessionRow>([\.day])
        var day: Int
        var session: String
        var startedAt: Date?
        var lastAt: Date?
        var completedAt: Date?
        var completed: Bool
        var done: Int
        var total: Int
        var recitations: Int

        init(day: Int, session: String) {
            self.day = day
            self.session = session
            self.completed = false
            self.done = 0
            self.total = 0
            self.recitations = 0
        }
    }

    /// One dhikr's count in the current reading of a session on one day. Pruned after 30 days.
    @Model final class DhikrCountRow {
        #Unique<DhikrCountRow>([\.day, \.session, \.dhikr])
        #Index<DhikrCountRow>([\.day], [\.day, \.session])
        var day: Int
        var session: String
        var dhikr: String
        var count: Int

        init(day: Int, session: String, dhikr: String, count: Int) {
            self.day = day
            self.session = session
            self.dhikr = dhikr
            self.count = count
        }
    }

    /// A lifetime total: `kind` says which tally ("dhikr", "afterPrayer", "tasbih", or "counter"
    /// for single numbers such as all recitations), `key` which entry of it.
    @Model final class TallyRow {
        #Unique<TallyRow>([\.kind, \.key])
        var kind: String
        var key: String
        var value: Int

        init(kind: String, key: String, value: Int) {
            self.kind = kind
            self.key = key
            self.value = value
        }
    }

    /// One tasbih counter (a preset, or `TasbihRecord.freeCount`) on one day.
    @Model final class TasbihRow {
        #Unique<TasbihRow>([\.day, \.preset])
        #Index<TasbihRow>([\.day])
        var day: Int
        var preset: String
        var startedAt: Date?
        var lastAt: Date?
        var count: Int
        var current: Int

        init(day: Int, preset: String, count: Int, current: Int) {
            self.day = day
            self.preset = preset
            self.count = count
            self.current = current
        }
    }

    /// One day's fast.
    @Model final class FastRow {
        #Unique<FastRow>([\.day])
        var day: Int
        var kind: String
        var status: String
        var loggedAt: Date?

        init(day: Int, kind: String, status: String, loggedAt: Date?) {
            self.day = day
            self.kind = kind
            self.status = status
            self.loggedAt = loggedAt
        }
    }

    /// An import that ran: from where, when, and what it brought (JSON of `ImportReport`).
    @Model final class ImportRow {
        #Unique<ImportRow>([\.source])
        var source: String
        var at: Date
        var report: String

        init(source: String, at: Date, report: String) {
            self.source = source
            self.at = at
            self.report = report
        }
    }
}

enum AzkarSchemaV2: VersionedSchema {
    static let versionIdentifier = Schema.Version(2, 0, 0)

    static var models: [any PersistentModel.Type] {
        [PrayerRow.self, SunnahRow.self, SessionRow.self, DhikrCountRow.self, TallyRow.self, TasbihRow.self, FastRow.self, ImportRow.self, QuranEntryRow.self, QuranBookmarkRow.self]
    }

    /// One obligatory prayer's status on one day.
    @Model final class PrayerRow {
        #Unique<PrayerRow>([\.day, \.prayer])
        #Index<PrayerRow>([\.day])
        var day: Int
        var prayer: String
        var status: String
        var loggedAt: Date?

        init(day: Int, prayer: String, status: String, loggedAt: Date?) {
            self.day = day
            self.prayer = prayer
            self.status = status
            self.loggedAt = loggedAt
        }
    }

    /// One sunnah prayer ticked on one day.
    @Model final class SunnahRow {
        #Unique<SunnahRow>([\.day, \.sunnah])
        #Index<SunnahRow>([\.day])
        var day: Int
        var sunnah: String
        var at: Date

        init(day: Int, sunnah: String, at: Date) {
            self.day = day
            self.sunnah = sunnah
            self.at = at
        }
    }

    /// One azkar session's record on one day (`AzkarSession.description` as the key).
    @Model final class SessionRow {
        #Unique<SessionRow>([\.day, \.session])
        #Index<SessionRow>([\.day])
        var day: Int
        var session: String
        var startedAt: Date?
        var lastAt: Date?
        var completedAt: Date?
        var completed: Bool
        var done: Int
        var total: Int
        var recitations: Int

        init(day: Int, session: String) {
            self.day = day
            self.session = session
            self.completed = false
            self.done = 0
            self.total = 0
            self.recitations = 0
        }
    }

    /// One dhikr's count in the current reading of a session on one day. Pruned after 30 days.
    @Model final class DhikrCountRow {
        #Unique<DhikrCountRow>([\.day, \.session, \.dhikr])
        #Index<DhikrCountRow>([\.day], [\.day, \.session])
        var day: Int
        var session: String
        var dhikr: String
        var count: Int

        init(day: Int, session: String, dhikr: String, count: Int) {
            self.day = day
            self.session = session
            self.dhikr = dhikr
            self.count = count
        }
    }

    /// A lifetime total: `kind` says which tally ("dhikr", "afterPrayer", "tasbih", or "counter"
    /// for single numbers such as all recitations), `key` which entry of it.
    @Model final class TallyRow {
        #Unique<TallyRow>([\.kind, \.key])
        var kind: String
        var key: String
        var value: Int

        init(kind: String, key: String, value: Int) {
            self.kind = kind
            self.key = key
            self.value = value
        }
    }

    /// One tasbih counter (a preset, or `TasbihRecord.freeCount`) on one day.
    @Model final class TasbihRow {
        #Unique<TasbihRow>([\.day, \.preset])
        #Index<TasbihRow>([\.day])
        var day: Int
        var preset: String
        var startedAt: Date?
        var lastAt: Date?
        var count: Int
        var current: Int

        init(day: Int, preset: String, count: Int, current: Int) {
            self.day = day
            self.preset = preset
            self.count = count
            self.current = current
        }
    }

    /// One day's fast.
    @Model final class FastRow {
        #Unique<FastRow>([\.day])
        var day: Int
        var kind: String
        var status: String
        var loggedAt: Date?

        init(day: Int, kind: String, status: String, loggedAt: Date?) {
            self.day = day
            self.kind = kind
            self.status = status
            self.loggedAt = loggedAt
        }
    }

    /// An import that ran: from where, when, and what it brought (JSON of `ImportReport`).
    @Model final class ImportRow {
        #Unique<ImportRow>([\.source])
        var source: String
        var at: Date
        var report: String

        init(source: String, at: Date, report: String) {
            self.source = source
            self.at = at
            self.report = report
        }
    }

    /// One thing recorded about reading the Quran (`QuranEntry`). Kept for good.
    @Model final class QuranEntryRow {
        #Unique<QuranEntryRow>([\.id])
        #Index<QuranEntryRow>([\.day])
        var id: UUID
        var day: Int
        var at: Date
        var kind: String
        var fromPage: Int
        var toPage: Int

        init(id: UUID, day: Int, at: Date, kind: String, fromPage: Int, toPage: Int) {
            self.id = id
            self.day = day
            self.at = at
            self.kind = kind
            self.fromPage = fromPage
            self.toPage = toPage
        }
    }

    /// One bookmarked page of the mushaf.
    @Model final class QuranBookmarkRow {
        #Unique<QuranBookmarkRow>([\.page])
        var page: Int
        var at: Date

        init(page: Int, at: Date) {
            self.page = page
            self.at = at
        }
    }
}

enum AzkarSchemaV3: VersionedSchema {
    static let versionIdentifier = Schema.Version(3, 0, 0)

    static var models: [any PersistentModel.Type] {
        [PrayerRow.self, SunnahRow.self, SessionRow.self, DhikrCountRow.self, TallyRow.self, TasbihRow.self, FastRow.self, ImportRow.self, QuranEntryRow.self, QuranBookmarkRow.self, SeasonRow.self]
    }

    /// One obligatory prayer's status on one day.
    @Model final class PrayerRow {
        #Unique<PrayerRow>([\.day, \.prayer])
        #Index<PrayerRow>([\.day])
        var day: Int
        var prayer: String
        var status: String
        var loggedAt: Date?

        init(day: Int, prayer: String, status: String, loggedAt: Date?) {
            self.day = day
            self.prayer = prayer
            self.status = status
            self.loggedAt = loggedAt
        }
    }

    /// One sunnah prayer ticked on one day.
    @Model final class SunnahRow {
        #Unique<SunnahRow>([\.day, \.sunnah])
        #Index<SunnahRow>([\.day])
        var day: Int
        var sunnah: String
        var at: Date

        init(day: Int, sunnah: String, at: Date) {
            self.day = day
            self.sunnah = sunnah
            self.at = at
        }
    }

    /// One azkar session's record on one day (`AzkarSession.description` as the key).
    @Model final class SessionRow {
        #Unique<SessionRow>([\.day, \.session])
        #Index<SessionRow>([\.day])
        var day: Int
        var session: String
        var startedAt: Date?
        var lastAt: Date?
        var completedAt: Date?
        var completed: Bool
        var done: Int
        var total: Int
        var recitations: Int

        init(day: Int, session: String) {
            self.day = day
            self.session = session
            self.completed = false
            self.done = 0
            self.total = 0
            self.recitations = 0
        }
    }

    /// One dhikr's count in the current reading of a session on one day. Pruned after 30 days.
    @Model final class DhikrCountRow {
        #Unique<DhikrCountRow>([\.day, \.session, \.dhikr])
        #Index<DhikrCountRow>([\.day], [\.day, \.session])
        var day: Int
        var session: String
        var dhikr: String
        var count: Int

        init(day: Int, session: String, dhikr: String, count: Int) {
            self.day = day
            self.session = session
            self.dhikr = dhikr
            self.count = count
        }
    }

    /// A lifetime total: `kind` says which tally ("dhikr", "afterPrayer", "tasbih", or "counter"
    /// for single numbers such as all recitations), `key` which entry of it.
    @Model final class TallyRow {
        #Unique<TallyRow>([\.kind, \.key])
        var kind: String
        var key: String
        var value: Int

        init(kind: String, key: String, value: Int) {
            self.kind = kind
            self.key = key
            self.value = value
        }
    }

    /// One tasbih counter (a preset, or `TasbihRecord.freeCount`) on one day.
    @Model final class TasbihRow {
        #Unique<TasbihRow>([\.day, \.preset])
        #Index<TasbihRow>([\.day])
        var day: Int
        var preset: String
        var startedAt: Date?
        var lastAt: Date?
        var count: Int
        var current: Int

        init(day: Int, preset: String, count: Int, current: Int) {
            self.day = day
            self.preset = preset
            self.count = count
            self.current = current
        }
    }

    /// One day's fast.
    @Model final class FastRow {
        #Unique<FastRow>([\.day])
        var day: Int
        var kind: String
        var status: String
        var loggedAt: Date?

        init(day: Int, kind: String, status: String, loggedAt: Date?) {
            self.day = day
            self.kind = kind
            self.status = status
            self.loggedAt = loggedAt
        }
    }

    /// An import that ran: from where, when, and what it brought (JSON of `ImportReport`).
    @Model final class ImportRow {
        #Unique<ImportRow>([\.source])
        var source: String
        var at: Date
        var report: String

        init(source: String, at: Date, report: String) {
            self.source = source
            self.at = at
            self.report = report
        }
    }

    /// One thing recorded about reading the Quran (`QuranEntry`). Kept for good.
    @Model final class QuranEntryRow {
        #Unique<QuranEntryRow>([\.id])
        #Index<QuranEntryRow>([\.day])
        var id: UUID
        var day: Int
        var at: Date
        var kind: String
        var fromPage: Int
        var toPage: Int

        init(id: UUID, day: Int, at: Date, kind: String, fromPage: Int, toPage: Int) {
            self.id = id
            self.day = day
            self.at = at
            self.kind = kind
            self.fromPage = fromPage
            self.toPage = toPage
        }
    }

    /// One bookmarked page of the mushaf.
    @Model final class QuranBookmarkRow {
        #Unique<QuranBookmarkRow>([\.page])
        var page: Int
        var at: Date

        init(page: Int, at: Date) {
            self.page = page
            self.at = at
        }
    }

    /// One deed of Ramadan or the Eids on one day (`SeasonRecord`). Kept for good.
    @Model final class SeasonRow {
        #Unique<SeasonRow>([\.day, \.deed])
        #Index<SeasonRow>([\.day])
        var day: Int
        var deed: String
        var at: Date
        var place: String?
        var rakahs: Int?

        init(day: Int, deed: String, at: Date, place: String?, rakahs: Int?) {
            self.day = day
            self.deed = deed
            self.at = at
            self.place = place
            self.rakahs = rakahs
        }
    }
}

typealias PrayerRow = AzkarSchemaV3.PrayerRow
typealias SunnahRow = AzkarSchemaV3.SunnahRow
typealias SessionRow = AzkarSchemaV3.SessionRow
typealias DhikrCountRow = AzkarSchemaV3.DhikrCountRow
typealias TallyRow = AzkarSchemaV3.TallyRow
typealias TasbihRow = AzkarSchemaV3.TasbihRow
typealias FastRow = AzkarSchemaV3.FastRow
typealias ImportRow = AzkarSchemaV3.ImportRow
typealias QuranEntryRow = AzkarSchemaV3.QuranEntryRow
typealias QuranBookmarkRow = AzkarSchemaV3.QuranBookmarkRow
typealias SeasonRow = AzkarSchemaV3.SeasonRow

/// The schema's history, oldest first; add a stage for each new version.
enum AzkarMigrationPlan: SchemaMigrationPlan {
    static var schemas: [any VersionedSchema.Type] { [AzkarSchemaV1.self, AzkarSchemaV2.self, AzkarSchemaV3.self] }
    static var stages: [MigrationStage] {
        [
            // V2 only adds the Quran's two tables.
            .lightweight(fromVersion: AzkarSchemaV1.self, toVersion: AzkarSchemaV2.self),
            // V3 only adds the season records' table.
            .lightweight(fromVersion: AzkarSchemaV2.self, toVersion: AzkarSchemaV3.self),
        ]
    }
}

extension DayKey {
    /// The day as `yyyymmdd`, the form rows are keyed by.
    var number: Int { year * 10000 + month * 100 + day }

    init?(number: Int) {
        self.init(year: number / 10000, month: number / 100 % 100, day: number % 100)
    }
}
