import AzkarKit
import Foundation
import Observation
import UIKit

/// Keeps backups so the records outlive the app and this iPhone: in the app's own iCloud Drive
/// container whenever the user has iCloud (on unless they turn it off), and in a folder the user
/// chose, if they chose one. It writes when the app goes to the background and in background
/// refreshes, whenever the store's revision has moved; each place keeps its own revision. Nothing
/// is written while the records are empty, so erasing or a new install leaves the backups already
/// there alone.
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
        static let iCloudOff = "autoBackup.iCloudOff"
        static let iCloudLastAt = "autoBackup.iCloudLastAt"
        static let iCloudRevision = "autoBackup.iCloudRevision"
        static let iCloudOwnName = "autoBackup.iCloudOwnName"
    }

    private(set) var folderName: String?
    private(set) var lastBackupAt: Date?
    /// The last attempt did not reach the folder.
    private(set) var hasFailed = false
    private(set) var isRunning = false

    /// Signed into iCloud with iCloud Drive on for Azkar.
    private(set) var iCloudAvailable = ICloudBackups.isAvailable
    private(set) var iCloudLastBackupAt: Date?
    /// The last attempt did not reach iCloud (it being off or signed out is not a failure).
    private(set) var iCloudHasFailed = false
    /// Backing up to iCloud, on unless the user turned it off.
    var iCloudOn: Bool {
        didSet {
            let defaults = UserDefaults.standard
            defaults.set(!iCloudOn, forKey: Key.iCloudOff)
            defaults.removeObject(forKey: Key.iCloudRevision)
            iCloudHasFailed = false
            if iCloudOn { Task { await backUp() } }
        }
    }

    private init() {
        let defaults = UserDefaults.standard
        folderName = defaults.string(forKey: Key.folderName)
        lastBackupAt = defaults.object(forKey: Key.lastAt) as? Date
        iCloudOn = !defaults.bool(forKey: Key.iCloudOff)
        iCloudLastBackupAt = defaults.object(forKey: Key.iCloudLastAt) as? Date
        NotificationCenter.default.addObserver(forName: .NSUbiquityIdentityDidChange, object: nil, queue: .main) { _ in
            MainActor.assumeIsolated { AutoBackup.shared.iCloudAvailable = ICloudBackups.isAvailable }
        }
    }

    var isOn: Bool { folderName != nil }

    /// A backup in iCloud this install restored from: the records here now hold all of it, so a
    /// backup today may replace it (see `writeToICloud`).
    func restored(fromICloud name: String) {
        UserDefaults.standard.set(name, forKey: Key.iCloudOwnName)
    }

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

    /// Writes today's backup to each place whose copy is older than the records.
    func backUp(evenIfUnchanged: Bool = false) async {
        let defaults = UserDefaults.standard
        let bookmark = defaults.data(forKey: Key.bookmark)
        iCloudAvailable = ICloudBackups.isAvailable
        let toICloud = iCloudOn && iCloudAvailable
        guard !isRunning, bookmark != nil || toICloud else { return }
        isRunning = true
        defer { isRunning = false }
        // Going to the background leaves a few seconds, which this asks to finish in.
        let time = BackgroundTime(name: "Azkar backup")
        defer { time.end() }
        let store: RecordStore
        let revision: Int
        do {
            store = try SharedRecords.store()
            revision = try await store.revision()
        } catch {
            print("Azkar: the automatic backup can't read the records: \(error)")
            if bookmark != nil { hasFailed = true }
            if toICloud { iCloudHasFailed = true }
            return
        }
        func due(_ key: String) -> Bool { evenIfUnchanged || defaults.object(forKey: key) as? Int != revision }
        let folderDue = bookmark != nil && due(Key.revision)
        let iCloudDue = toICloud && due(Key.iCloudRevision)
        guard folderDue || iCloudDue else { return }
        let records: RecordsSnapshot
        do {
            records = try await store.snapshot()
        } catch {
            print("Azkar: the automatic backup can't read the records: \(error)")
            if folderDue { hasFailed = true }
            if iCloudDue { iCloudHasFailed = true }
            return
        }
        guard !records.isEmpty else { return }
        let settings = SharedRecords.settings.load()
        let data = Backup.export(records: records, settings: settings)
        let name = Backup.fileName(in: settings.timeZone)
        let catalog = store.catalog
        if folderDue, let bookmark {
            do {
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
        if iCloudDue {
            await writeToICloud(data, as: name, revision: revision, catalog: catalog)
        }
    }

    /// Saves the backup in iCloud. iCloud turned off or signed out in the meantime is no failure:
    /// it is tried again next time. A file of that day which this install did not write (another
    /// iPhone's, or one from before the app was reinstalled) is never replaced: it may hold records
    /// this one lacks, so today's backup waits for tomorrow's name, unless it was restored here.
    private func writeToICloud(_ data: Data, as name: String, revision: Int, catalog: any SessionCatalog) async {
        let defaults = UserDefaults.standard
        let ownName = defaults.string(forKey: Key.iCloudOwnName)
        do {
            let outcome = try await Task.detached(priority: .utility) { () throws -> ICloudBackups.Outcome in
                guard let folder = ICloudBackups.folder() else { return .unavailable }
                if name != ownName, try BackupFolder.backups(in: folder).contains(name) { return .held }
                try BackupFolder.save(data, as: name, in: folder, catalog: catalog)
                return .saved
            }.value
            switch outcome {
            case .saved:
                let now = Date.now
                defaults.set(name, forKey: Key.iCloudOwnName)
                defaults.set(revision, forKey: Key.iCloudRevision)
                defaults.set(now, forKey: Key.iCloudLastAt)
                iCloudLastBackupAt = now
                iCloudHasFailed = false
            case .held:
                print("Azkar: \(name) in iCloud was written elsewhere; keeping it until tomorrow's backup")
            case .unavailable:
                iCloudAvailable = false
            }
        } catch {
            print("Azkar: the iCloud backup failed: \(error)")
            iCloudHasFailed = true
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

/// Backups in the app's iCloud Drive container, `Documents/Backups`, which shows in Files as
/// iCloud Drive › Azkar › Backups.
nonisolated enum ICloudBackups {
    static let container = "iCloud.io.github.ahmedwalid4499.azkar"

    enum Outcome: Sendable {
        case saved, held, unavailable
    }

    /// Signed into iCloud with iCloud Drive on. Quick enough for the main thread.
    static var isAvailable: Bool { FileManager.default.ubiquityIdentityToken != nil }

    /// The folder, made if it is missing; nil without iCloud. It can take a moment the first
    /// time, so never on the main thread.
    static func folder() -> URL? {
        guard let root = FileManager.default.url(forUbiquityContainerIdentifier: container) else { return nil }
        let folder = root.appending(path: "Documents/Backups", directoryHint: .isDirectory)
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        return folder
    }

    /// The backups in iCloud by name, newest first; empty without iCloud.
    static func list() async -> [String] {
        await Task.detached(priority: .userInitiated) {
            guard let folder = folder() else { return [] }
            return ((try? BackupFolder.backups(in: folder)) ?? []).reversed()
        }.value
    }

    /// Reads one, downloading it first if iCloud has not yet.
    static func read(_ name: String, catalog: any SessionCatalog) async throws -> Backup.Contents {
        try await Task.detached(priority: .userInitiated) {
            guard let folder = folder() else { throw CocoaError(.ubiquitousFileUnavailable) }
            return try Backup.read(BackupFolder.read(name, in: folder), catalog: catalog)
        }.value
    }
}

/// Background time asked of iOS, given back exactly once: when the work is done, or when the time
/// runs out first (iOS ends an app that keeps it past then).
@MainActor
private final class BackgroundTime {
    private var id = UIBackgroundTaskIdentifier.invalid

    init(name: String) {
        id = UIApplication.shared.beginBackgroundTask(withName: name) { [weak self] in self?.end() }
    }

    func end() {
        guard id != .invalid else { return }
        UIApplication.shared.endBackgroundTask(id)
        id = .invalid
    }
}
