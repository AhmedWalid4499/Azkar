import AzkarKit
import Foundation
import Observation
import UIKit

/// Keeps a backup in a folder the user chose, so the records outlive the app and this iPhone. It
/// writes when the app goes to the background and in background refreshes, whenever the store's
/// revision has moved. Nothing is written while the records are empty, so erasing or a new install
/// leaves the backups already there alone.
///
/// The folder is reached through a security-scoped bookmark, kept on this device only.
@MainActor
@Observable
final class AutoBackup {
    static let shared = AutoBackup()

    private enum Key {
        static let bookmark = "autoBackup.bookmark"
        static let folderName = "autoBackup.folderName"
        static let lastAt = "autoBackup.lastAt"
        static let revision = "autoBackup.revision"
    }

    private(set) var folderName: String?
    private(set) var lastBackupAt: Date?
    /// The last attempt did not reach the folder.
    private(set) var hasFailed = false
    private(set) var isRunning = false

    private init() {
        let defaults = UserDefaults.standard
        folderName = defaults.string(forKey: Key.folderName)
        lastBackupAt = defaults.object(forKey: Key.lastAt) as? Date
    }

    var isOn: Bool { folderName != nil }

    /// Starts backing up to `url`, with a first backup now.
    func choose(_ url: URL) async {
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }
        do {
            let bookmark = try url.bookmarkData(options: [], includingResourceValuesForKeys: nil, relativeTo: nil)
            UserDefaults.standard.set(bookmark, forKey: Key.bookmark)
            UserDefaults.standard.set(url.lastPathComponent, forKey: Key.folderName)
            folderName = url.lastPathComponent
        } catch {
            print("Azkar: the backup folder can't be kept: \(error)")
            hasFailed = true
            return
        }
        await backUp(evenIfUnchanged: true)
    }

    /// Stops backing up. The files already in the folder stay.
    func turnOff() {
        let defaults = UserDefaults.standard
        for key in [Key.bookmark, Key.folderName, Key.lastAt, Key.revision] { defaults.removeObject(forKey: key) }
        folderName = nil
        lastBackupAt = nil
        hasFailed = false
    }

    /// Writes today's backup, if the records have changed since the last.
    func backUp(evenIfUnchanged: Bool = false) async {
        let defaults = UserDefaults.standard
        guard !isRunning, let bookmark = defaults.data(forKey: Key.bookmark) else { return }
        isRunning = true
        defer { isRunning = false }
        // Going to the background leaves a few seconds, which this asks to finish in.
        let task = UIApplication.shared.beginBackgroundTask(withName: "Azkar backup", expirationHandler: nil)
        defer { UIApplication.shared.endBackgroundTask(task) }
        do {
            let store = try SharedRecords.store()
            let revision = try await store.revision()
            if !evenIfUnchanged, defaults.object(forKey: Key.revision) as? Int == revision { return }
            let records = try await store.snapshot()
            guard !records.isEmpty else { return }
            let settings = SharedRecords.settings.load()
            let data = Backup.export(records: records, settings: settings)
            let name = Backup.fileName(in: settings.timeZone)
            let catalog = store.catalog
            let renewed = try await Task.detached(priority: .utility) {
                try Self.write(data, as: name, bookmark: bookmark, catalog: catalog)
            }.value
            if let renewed { defaults.set(renewed, forKey: Key.bookmark) }
            let now = Date.now
            defaults.set(revision, forKey: Key.revision)
            defaults.set(now, forKey: Key.lastAt)
            lastBackupAt = now
            hasFailed = false
        } catch {
            print("Azkar: the automatic backup failed: \(error)")
            hasFailed = true
        }
    }

    /// Saves the file inside the folder's security scope. Returns a new bookmark if the old is stale.
    private nonisolated static func write(_ data: Data, as name: String, bookmark: Data, catalog: any SessionCatalog) throws -> Data? {
        var isStale = false
        let folder = try URL(resolvingBookmarkData: bookmark, options: [], relativeTo: nil, bookmarkDataIsStale: &isStale)
        let scoped = folder.startAccessingSecurityScopedResource()
        defer { if scoped { folder.stopAccessingSecurityScopedResource() } }
        try BackupFolder.save(data, as: name, in: folder, catalog: catalog)
        return isStale ? try? folder.bookmarkData(options: [], includingResourceValuesForKeys: nil, relativeTo: nil) : nil
    }
}
