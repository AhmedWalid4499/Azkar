import AzkarKit
import CoreTransferable
import SwiftUI
import UniformTypeIdentifiers

/// The whole history as a spreadsheet, shared from a temporary file.
struct TrackerExportSection: View {
    let data: TrackerData
    @Environment(\.trackerFormat) private var format

    var body: some View {
        Section {
            if data.hasAnyRecord {
                let file = TrackerHistoryFile(
                    history: data.history,
                    options: HistoryCSV.Options(locale: format.display, timeZone: data.clock.timeZone.identifier,
                                                hijriOffset: data.settings.app.hijriOffset, dataset: data.dataset),
                    name: format.string(LocalizedStringResource("Azkar history \(data.today.description)", table: "Tracker"))
                )
                ShareLink(item: file, preview: SharePreview(Text(file.name), image: Image(systemName: "tablecells"))) {
                    Label { Text("Export history (CSV)", tableName: "Tracker") } icon: { Image(systemName: "square.and.arrow.up") }
                }
            } else {
                Label { Text("Export history (CSV)", tableName: "Tracker") } icon: { Image(systemName: "square.and.arrow.up") }
                    .foregroundStyle(.secondary)
            }
        } header: {
            Text("Your history", tableName: "Tracker")
        } footer: {
            if data.hasAnyRecord {
                Text("Every day you have recorded, with each prayer, sunnah prayer, azkar session, tasbih count and fast and when it was logged, as a spreadsheet file. To move your data to another device, use the backup in Settings.", tableName: "Tracker")
            } else {
                Text("Once you have recorded a day, your whole history can be exported here.", tableName: "Tracker")
            }
        }
    }
}

/// The CSV, written to a temporary file only when it is shared.
struct TrackerHistoryFile: Transferable {
    let history: TrackerHistory
    let options: HistoryCSV.Options
    /// The file's name, without the extension.
    let name: String

    nonisolated static var transferRepresentation: some TransferRepresentation {
        FileRepresentation(exportedContentType: .commaSeparatedText) { file in
            let directory = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString, directoryHint: .isDirectory)
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            let url = directory.appending(path: "\(file.name).csv")
            try Data(HistoryCSV.csv(file.history, options: file.options).utf8).write(to: url, options: .atomic)
            return SentTransferredFile(url)
        }
    }
}
