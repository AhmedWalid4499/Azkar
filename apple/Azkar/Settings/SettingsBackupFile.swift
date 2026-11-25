import AzkarKit
import CoreTransferable
import Foundation
import SwiftUI
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

extension SettingsBackupImport {
    /// Restores a read backup and reloads what the app shows.
    static func restore(_ contents: Backup.Contents, mode: Backup.Mode, app: AppEnvironment) async throws -> ImportReport {
        let report = try await Backup.restore(contents, into: app.store, settings: app.settingsStore, mode: mode)
        app.settings.reload()
        await app.records.reload()
        return report
    }
}

extension View {
    /// Asks how to restore a backup that was read: replace everything, or add to the records.
    /// The same question for a file and for iCloud.
    func restoreBackupDialog(_ pending: Binding<Backup.Contents?>, onRestore: @escaping (Backup.Contents, Backup.Mode) -> Void) -> some View {
        modifier(RestoreBackupDialog(pending: pending, onRestore: onRestore))
    }
}

private struct RestoreBackupDialog: ViewModifier {
    @Environment(\.locale) private var locale
    @Binding var pending: Backup.Contents?
    let onRestore: (Backup.Contents, Backup.Mode) -> Void

    func body(content: Content) -> some View {
        content.confirmationDialog(
            Text("Restore this backup?", tableName: SettingsText.table),
            isPresented: Binding(get: { pending != nil }, set: { if !$0 { pending = nil } }),
            titleVisibility: .visible,
            presenting: pending
        ) { contents in
            Button(role: .destructive) {
                pending = nil
                onRestore(contents, .replace)
            } label: {
                Text("Replace everything", tableName: SettingsText.table)
            }
            Button {
                pending = nil
                onRestore(contents, .merge)
            } label: {
                Text("Add to my records", tableName: SettingsText.table)
            }
        } message: { contents in
            Text(message(contents))
        }
    }

    private func message(_ contents: Backup.Contents) -> String {
        let preview = ImportReport(source: ImportReport.backup, at: .now, snapshot: contents.snapshot, settings: [])
        var lines: [String] = []
        if let exported = contents.exportedAt {
            let date = exported.formatted(Date.FormatStyle(date: .long, time: .shortened).locale(locale))
            lines.append(SettingsText.string("Exported \(date).", locale: locale))
        }
        lines.append(SettingsImportSummary.counts(preview, locale: locale))
        lines.append(SettingsText.string("“Replace everything” makes the app exactly as the backup is, settings included. “Add to my records” keeps what is here and adds what the backup has.", locale: locale))
        return lines.joined(separator: "\n\n")
    }
}
