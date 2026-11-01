import AzkarCore
import Foundation
import Testing
@testable import AzkarStore

@Suite struct BackupFolderTests {
    private func folder() throws -> URL {
        let url = FileManager.default.temporaryDirectory.appending(path: "BackupFolderTests-\(UUID().uuidString)", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        return url
    }

    private func backup() async throws -> Data {
        let store = try makeStore()
        try await store.countTasbih(nil, times: 33, on: day("2026-09-01"), at: instant("2026-09-01T05:00:00Z"))
        return Backup.export(records: try await store.snapshot(), settings: SettingsSnapshot(), at: instant("2026-09-01T06:00:00Z"))
    }

    private func save(_ data: Data, _ name: String, in folder: URL, keep: Int = BackupFolder.keep) throws {
        try BackupFolder.save(data, as: name, in: folder, catalog: StaticSessionCatalog.empty, keep: keep)
    }

    @Test func aSavedBackupReadsBackWithItsRecords() async throws {
        let folder = try folder()
        let data = try await backup()
        try save(data, "azkar-backup-2026-09-01.json", in: folder)
        let read = try Data(contentsOf: folder.appending(path: "azkar-backup-2026-09-01.json"))
        let contents = try Backup.read(read, catalog: StaticSessionCatalog.empty)
        #expect(contents.snapshot.records.tasbih[day("2026-09-01")]?[TasbihRecord.freeCount]?.count == 33)
    }

    @Test func aSecondSaveTheSameDayReplacesTheFirst() async throws {
        let folder = try folder()
        let data = try await backup()
        try save(data, "azkar-backup-2026-09-01.json", in: folder)
        try save(data, "azkar-backup-2026-09-01.json", in: folder)
        #expect(try BackupFolder.backups(in: folder) == ["azkar-backup-2026-09-01.json"])
    }

    @Test func aBadFileIsNeverWrittenOverAGoodOne() async throws {
        let folder = try folder()
        let data = try await backup()
        try save(data, "azkar-backup-2026-09-01.json", in: folder)
        for bad in [Data(), Data("not json".utf8), Data("{\"app\":\"other\"}".utf8)] {
            #expect(throws: BackupFolder.Failure.notABackup) { try save(bad, "azkar-backup-2026-09-01.json", in: folder) }
        }
        #expect(try Data(contentsOf: folder.appending(path: "azkar-backup-2026-09-01.json")) == data)
    }

    @Test func onlyTheLatestAreKept() async throws {
        let folder = try folder()
        let data = try await backup()
        for number in 1...5 { try save(data, "azkar-backup-2026-09-0\(number).json", in: folder, keep: 3) }
        #expect(try BackupFolder.backups(in: folder) == ["azkar-backup-2026-09-03.json", "azkar-backup-2026-09-04.json", "azkar-backup-2026-09-05.json"])
    }

    @Test func nothingElseInTheFolderIsTouched() async throws {
        let folder = try folder()
        let data = try await backup()
        for name in ["azkar-backup-old.json", "my-notes.json", "azkar-backup-2026-01-01.json.bak"] {
            try Data("mine".utf8).write(to: folder.appending(path: name))
        }
        for number in 1...3 { try save(data, "azkar-backup-2026-09-0\(number).json", in: folder, keep: 1) }
        let left = try FileManager.default.contentsOfDirectory(atPath: folder.path(percentEncoded: false)).sorted()
        #expect(left == ["azkar-backup-2026-01-01.json.bak", "azkar-backup-2026-09-03.json", "azkar-backup-old.json", "my-notes.json"])
    }
}
