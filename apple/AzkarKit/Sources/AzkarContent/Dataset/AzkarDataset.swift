import AzkarCore
import Foundation

/// The azkar dataset: every dhikr, the sessions that list them in order, the after-prayer list
/// and the tasbih presets. As `src/features/azkar/data/index.ts`.
///
/// Lists that the dataset does not have yet (the bedtime session, the after-prayer azkar and
/// the tasbih presets while they are being added) are empty, never an error.
public struct AzkarDataset: Hashable, Sendable {
    public var version: Int
    public var sources: [AzkarSource]
    /// Every dhikr by id.
    public var items: [String: Dhikr]
    /// Ordered dhikr ids of the morning, evening and bedtime sessions.
    public var collections: [AzkarSession: [String]]
    /// Ordered dhikr ids recited after the obligatory prayers.
    public var afterPrayerIDs: [String]
    /// Ordered dhikr ids offered as presets in the tasbih counter.
    public var tasbihIDs: [String]

    /// A list names a dhikr the dataset does not have.
    public struct UnknownDhikr: Error, Hashable, CustomStringConvertible {
        public var list: String
        public var id: String
        public var description: String { "\(list) references unknown dhikr \"\(id)\"" }
    }

    /// Checks that every list names only known azkar.
    public init(
        version: Int, sources: [AzkarSource], items: [String: Dhikr], collections: [AzkarSession: [String]],
        afterPrayerIDs: [String] = [], tasbihIDs: [String] = []
    ) throws {
        self.version = version
        self.sources = sources
        self.items = items
        self.collections = collections.filter { AzkarSession.regular.contains($0.key) }
        self.afterPrayerIDs = afterPrayerIDs
        self.tasbihIDs = tasbihIDs
        for session in AzkarSession.regular {
            for id in self.collections[session] ?? [] where items[id] == nil {
                throw UnknownDhikr(list: "Collection \"\(session)\"", id: id)
            }
        }
        for id in afterPrayerIDs where items[id] == nil { throw UnknownDhikr(list: "The after-prayer list", id: id) }
        for id in tasbihIDs where items[id] == nil { throw UnknownDhikr(list: "The tasbih list", id: id) }
    }

    /// Decodes `azkar.json`.
    public init(json data: Data) throws {
        let raw = try JSONDecoder().decode(RawDataset.self, from: data)
        var collections: [AzkarSession: [String]] = [:]
        for (key, ids) in raw.collections {
            if let session = AzkarSession(key), AzkarSession.regular.contains(session) { collections[session] = ids }
        }
        try self.init(
            version: raw.version, sources: raw.sources, items: raw.items, collections: collections,
            afterPrayerIDs: raw.afterPrayer ?? [], tasbihIDs: raw.tasbih ?? []
        )
    }

    /// The dataset bundled with the app. A broken bundle is a build error, which the tests catch.
    public static let bundled: AzkarDataset = {
        do {
            return try AzkarDataset(json: Data(contentsOf: AzkarResources.datasetURL))
        } catch {
            preconditionFailure("The bundled azkar.json does not load: \(error)")
        }
    }()

    private struct RawDataset: Decodable {
        var version: Int
        var sources: [AzkarSource]
        var items: [String: Dhikr]
        var collections: [String: [String]]
        var afterPrayer: [String]?
        var tasbih: [String]?
    }

    // MARK: - Reading

    public func dhikr(id: String) -> Dhikr? { items[id] }

    /// The bedtime, morning and evening sessions that have content, in display order.
    public var availableCollections: [AzkarSession] {
        AzkarSession.regular.filter { !(collections[$0] ?? []).isEmpty }
    }

    /// The prayers the dataset has after-prayer azkar for, in the order of the day.
    public var availableAfterPrayers: [Prayer] {
        Prayer.allCases.filter { !afterPrayerAzkar(for: $0).isEmpty }
    }

    /// The azkar of a session in recitation order; for an after-prayer session, as
    /// `afterPrayerAzkar(for:)` gives them.
    public func azkar(for session: AzkarSession) -> [Dhikr] {
        switch session {
        case let .afterPrayer(prayer): afterPrayerAzkar(for: prayer)
        default: (collections[session] ?? []).compactMap { items[$0] }
        }
    }

    /// The azkar said after one obligatory prayer, in order, each with `repeat` set to its
    /// count after that prayer (as `getAfterPrayerAzkar`), and with the narration of its place
    /// after the prayer when the dataset gives one.
    public func afterPrayerAzkar(for prayer: Prayer) -> [Dhikr] {
        afterPrayerIDs.compactMap { items[$0] }
            .filter { $0.afterPrayer?.applies(to: prayer) ?? true }
            .map { dhikr in
                var said = dhikr
                if let count = dhikr.afterPrayer?.repeatCounts[prayer] { said.repeat = count }
                if let narration = dhikr.afterPrayer?.narration {
                    if let reference = narration.reference { said.reference = reference }
                    if let virtue = narration.virtue { said.virtue = virtue }
                    if let note = narration.note { said.note = note }
                }
                return said
            }
    }

    /// Short formulas offered as presets in the tasbih counter, in order.
    public var tasbihPresets: [Dhikr] { tasbihIDs.compactMap { items[$0] } }

    /// The opening words of a dhikr's Arabic text, or `nil` when the dataset no longer has it.
    public func snippet(id: String) -> String? {
        items[id].map { RecitationText.snippet($0.arabic) }
    }
}
