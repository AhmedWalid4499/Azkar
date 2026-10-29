import Foundation
import SwiftData

/// Where the records live.
public enum StoreLocation: Hashable, Sendable {
    /// In the App Group container, shared with the widgets and App Intents. When the group is
    /// not available (a build without the entitlement), in the app's own Application Support.
    case shared
    /// A store file in this directory.
    case directory(URL)
    /// Nothing on disk, for tests and previews.
    case inMemory
}

/// Opens the records' SwiftData container.
public enum StoreContainer {
    /// The App Group the app and its extensions share (signs with a free team).
    public static let appGroup = "group.io.github.ahmedwalid4499.azkar"
    static let fileName = "Azkar.store"

    /// An opened container and where its file is (`nil` in memory).
    public struct Opened: Sendable {
        public let container: ModelContainer
        public let url: URL?
        /// False when the App Group was unavailable and the app's own container was used.
        public let isShared: Bool
    }

    public static func open(_ location: StoreLocation = .shared) throws -> Opened {
        let schema = Schema(versionedSchema: AzkarSchemaV1.self)
        let configuration: ModelConfiguration
        let url: URL?
        var isShared = false
        switch location {
        case .inMemory:
            // A unique name keeps two in-memory containers in one process apart.
            configuration = ModelConfiguration(UUID().uuidString, schema: schema, isStoredInMemoryOnly: true, cloudKitDatabase: .none)
            url = nil
        case let .directory(directory):
            url = try prepared(directory).appending(path: fileName)
            configuration = ModelConfiguration(schema: schema, url: url!, cloudKitDatabase: .none)
        case .shared:
            let directory: URL
            if let group = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup) {
                directory = group.appending(path: "Library/Application Support", directoryHint: .isDirectory)
                isShared = true
            } else {
                directory = URL.applicationSupportDirectory
            }
            url = try prepared(directory).appending(path: fileName)
            configuration = ModelConfiguration(schema: schema, url: url!, cloudKitDatabase: .none)
        }
        let container = try ModelContainer(for: schema, migrationPlan: AzkarMigrationPlan.self, configurations: configuration)
        return Opened(container: container, url: url, isShared: isShared)
    }

    private static func prepared(_ directory: URL) throws -> URL {
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        return directory
    }
}
