import AzkarCore
import Foundation
import SwiftData

extension RecordStore {
    /// Replaces every record with `snapshot`, in one save: all of it or, when anything fails,
    /// none of it. This is what restoring a backup does on the website (`importBackup`).
    public func replaceAll(with snapshot: RecordsSnapshot) throws {
        try replaceAll(with: snapshot, recording: nil)
    }

    /// Adds what `snapshot` holds that the store does not, in one save. Where both have a
    /// prayer, a session, a counter or a fast on the same day, the store's own stays; lifetime
    /// totals are added together.
    public func merge(_ snapshot: RecordsSnapshot) throws {
        try merge(snapshot, recording: nil)
    }

    /// Merges `snapshot` and records `report`, in the same save. With `once`, nothing happens when
    /// an import from the same source was recorded before; returns whether it ran.
    @discardableResult
    func merge(_ snapshot: RecordsSnapshot, recording report: ImportReport?, once: Bool = false) throws -> Bool {
        let rows = rows()
        if once, let source = report?.source, try !rows.fetch(#Predicate<ImportRow> { $0.source == source }).isEmpty {
            return false
        }
        try rows.insert(snapshot, over: try rows.snapshot())
        if let report { try record(report, in: rows) }
        try commit(rows)
        return true
    }

    /// Replaces every record with `snapshot` and records `report`, in one save.
    func replaceAll(with snapshot: RecordsSnapshot, recording report: ImportReport?) throws {
        let rows = rows()
        try rows.deleteAll()
        try rows.insert(snapshot)
        if let report { try record(report, in: rows) }
        try commit(rows)
    }

    /// Every import recorded, oldest first.
    public func importReports() throws -> [ImportReport] {
        let rows: [ImportRow] = try rows().fetch()
        let decoder = JSONDecoder()
        return rows.compactMap { try? decoder.decode(ImportReport.self, from: Data($0.report.utf8)) }.sorted { $0.at < $1.at }
    }

    /// Whether the web-based app's data was imported already.
    public func hasImported(_ source: String) throws -> Bool {
        try !rows().fetch(#Predicate<ImportRow> { $0.source == source }).isEmpty
    }

    private func record(_ report: ImportReport, in rows: RecordRows) throws {
        let text = String(decoding: try JSONEncoder().encode(report), as: UTF8.self)
        // One row per import of the web-based app (it runs once); a row per restored backup.
        let source = report.source == ImportReport.webApp ? report.source : "\(report.source):\(UUID().uuidString)"
        rows.context.insert(ImportRow(source: source, at: report.at, report: text))
    }
}
