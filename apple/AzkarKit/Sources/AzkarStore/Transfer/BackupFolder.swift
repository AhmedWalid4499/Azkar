import AzkarCore
import Foundation

/// Backups kept in a folder the user chose: one file a day, named as `Backup.fileName`, the latest
/// `keep` of them. A file that is not a sound backup is never written, so a good copy is never
/// replaced by a bad one, and only files of that name are ever removed.
public enum BackupFolder {
    public static let keep = 30

    public enum Failure: Error, Hashable, Sendable {
        /// The file would not read back as a backup.
        case notABackup
    }

    /// Saves `data` as `name` in `folder`, replacing that day's file, then removes the oldest
    /// backups beyond `keep`. Coordinated, as a folder in iCloud Drive needs.
    public static func save(_ data: Data, as name: String, in folder: URL, catalog: any SessionCatalog, keep: Int = keep) throws {
        guard (try? Backup.read(data, catalog: catalog)) != nil else { throw Failure.notABackup }
        let url = folder.appending(path: name, directoryHint: .notDirectory)
        var coordination: NSError?
        var failure: Error?
        NSFileCoordinator().coordinate(writingItemAt: url, options: .forReplacing, error: &coordination) { url in
            do {
                try data.write(to: url, options: .atomic)
            } catch {
                failure = error
            }
        }
        if let error = failure ?? coordination { throw error }
        try prune(folder, keep: keep)
    }

    /// The backups in `folder` by name, oldest first: the date in the name sorts them. A file
    /// iCloud has not downloaded yet, which may show as `.<name>.icloud`, is listed by its name.
    public static func backups(in folder: URL) throws -> [String] {
        let names = try FileManager.default.contentsOfDirectory(atPath: folder.path(percentEncoded: false))
        return Set(names.map(downloadedName)).filter(isBackupName).sorted()
    }

    /// Reads the backup `name` in `folder`, coordinated, so iCloud downloads it first if it must.
    public static func read(_ name: String, in folder: URL) throws -> Data {
        let url = folder.appending(path: name, directoryHint: .notDirectory)
        // Only a file in iCloud can be downloaded; elsewhere this has nothing to do.
        try? FileManager.default.startDownloadingUbiquitousItem(at: url)
        var coordination: NSError?
        var result: Result<Data, Error> = .failure(CocoaError(.fileReadUnknown))
        NSFileCoordinator().coordinate(readingItemAt: url, options: [], error: &coordination) { url in
            result = Result { try Data(contentsOf: url) }
        }
        if let coordination { throw coordination }
        return try result.get()
    }

    /// The day in a backup's name: `azkar-backup-2026-09-01.json` is 1 September 2026.
    public static func day(of name: String) -> DayKey? {
        guard isBackupName(name) else { return nil }
        return DayKey(String(name.dropFirst("azkar-backup-".count).dropLast(".json".count)))
    }

    private static func prune(_ folder: URL, keep: Int) throws {
        for name in try backups(in: folder).dropLast(keep) {
            let url = folder.appending(path: name, directoryHint: .notDirectory)
            var coordination: NSError?
            NSFileCoordinator().coordinate(writingItemAt: url, options: .forDeleting, error: &coordination) { url in
                try? FileManager.default.removeItem(at: url)
            }
            try? FileManager.default.removeItem(at: folder.appending(path: ".\(name).icloud", directoryHint: .notDirectory))
        }
    }

    /// `.azkar-backup-2026-09-01.json.icloud`, the stand-in for a file not downloaded, is
    /// `azkar-backup-2026-09-01.json`.
    static func downloadedName(_ name: String) -> String {
        guard name.hasPrefix("."), name.hasSuffix(".icloud") else { return name }
        return String(name.dropFirst().dropLast(".icloud".count))
    }

    /// `azkar-backup-YYYY-MM-DD.json`.
    static func isBackupName(_ name: String) -> Bool {
        name.wholeMatch(of: /azkar-backup-\d{4}-\d{2}-\d{2}\.json/) != nil
    }
}
