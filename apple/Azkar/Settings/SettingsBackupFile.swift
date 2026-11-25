import AzkarKit
import CoreTransferable
import Foundation
import UniformTypeIdentifiers

/// Everything, as a backup file in the website's format, written only when it is shared or saved.
nonisolated struct SettingsBackupFile: Transferable {
    let records: RecordsSnapshot
    let settings: SettingsSnapshot
    let fileName: String

    static var transferRepresentation: some TransferRepresentation {
        FileRepresentation(exportedContentType: .json) { file in
            let folder = FileManager.default.temporaryDirectory.appending(path: "Backup-\(UUID().uuidString)", directoryHint: .isDirectory)
            try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
            let url = folder.appending(path: file.fileName)
            try Backup.export(records: file.records, settings: file.settings).write(to: url, options: .atomic)
            return SentTransferredFile(url)
        }
        .suggestedFileName { $0.fileName }
    }
}

/// Reading a backup the user picked.
enum SettingsBackupImport {
    enum Failure: Error {
        case unreadable
        case notABackup
    }

    /// Reads the file (inside its security scope) and checks it is an Azkar backup. Nothing is changed.
    static func read(_ url: URL, catalog: any SessionCatalog) throws(Failure) -> Backup.Contents {
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }
        guard let data = try? Data(contentsOf: url) else { throw .unreadable }
        do {
            return try Backup.read(data, catalog: catalog)
        } catch {
            throw .notABackup
        }
    }
}
