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

    /// The backups in `folder` by name, oldest first: the date in the name sorts them.
    public static func backups(in folder: URL) throws -> [String] {
        try FileManager.default.contentsOfDirectory(atPath: folder.path(percentEncoded: false)).filter(isBackupName).sorted()
    }

    private static func prune(_ folder: URL, keep: Int) throws {
        for name in try backups(in: folder).dropLast(keep) {
            let url = folder.appending(path: name, directoryHint: .notDirectory)
            var coordination: NSError?
            NSFileCoordinator().coordinate(writingItemAt: url, options: .forDeleting, error: &coordination) { url in
                try? FileManager.default.removeItem(at: url)
            }
        }
    }

    /// `azkar-backup-YYYY-MM-DD.json`.
    static func isBackupName(_ name: String) -> Bool {
        name.wholeMatch(of: /azkar-backup-\d{4}-\d{2}-\d{2}\.json/) != nil
    }
}
