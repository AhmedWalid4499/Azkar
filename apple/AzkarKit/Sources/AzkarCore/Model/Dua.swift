import Foundation

/// A dua of the user's own.
public struct DuaItem: Codable, Hashable, Sendable, Identifiable {
    public static let maxLength = 2000

    public var id: UUID
    public var text: String
    public var addedAt: Date

    public init(id: UUID = UUID(), text: String, addedAt: Date) {
        self.id = id
        self.text = text
        self.addedAt = addedAt
    }

    /// Trimmed, within the limit; `nil` when nothing is left.
    public static func cleaned(_ text: String) -> String? {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : String(trimmed.prefix(maxLength))
    }
}

/// One thing recorded about a dua. A dua taken off the list leaves its lines here, so the days
/// stay counted and only its words are gone.
public struct DuaEntry: Codable, Hashable, Sendable, Identifiable {
    public enum Kind: String, Codable, Sendable {
        case said
        case answered
    }

    public var id: UUID
    public var dua: UUID
    public var day: DayKey
    public var at: Date
    public var kind: Kind

    public init(id: UUID = UUID(), dua: UUID, day: DayKey, at: Date, kind: Kind) {
        self.id = id
        self.dua = dua
        self.day = day
        self.at = at
        self.kind = kind
    }
}

/// The list of duas with what the log says of each.
public struct DuaProgress: Hashable, Sendable {
    public struct Row: Hashable, Sendable, Identifiable {
        public var item: DuaItem
        public var said = 0
        public var lastSaidOn: DayKey?
        /// The line that marks it answered, when one does.
        public var answered: DuaEntry?

        public var id: UUID { item.id }
    }

    /// Those still being asked for, the newest first.
    public private(set) var open: [Row] = []
    /// Those answered, the latest first.
    public private(set) var answered: [Row] = []
    public private(set) var totalSaid = 0

    public init(items: [DuaItem], entries: [DuaEntry]) {
        var rows = Dictionary(uniqueKeysWithValues: items.map { ($0.id, Row(item: $0)) })
        for entry in entries.sorted(by: { $0.at < $1.at }) {
            switch entry.kind {
            case .said:
                totalSaid += 1
                rows[entry.dua]?.said += 1
                rows[entry.dua]?.lastSaidOn = entry.day
            case .answered:
                rows[entry.dua]?.answered = entry
            }
        }
        open = rows.values.filter { $0.answered == nil }.sorted { ($0.item.addedAt, $0.item.id.uuidString) > ($1.item.addedAt, $1.item.id.uuidString) }
        answered = rows.values.filter { $0.answered != nil }.sorted { ($0.answered!.at, $0.item.id.uuidString) > ($1.answered!.at, $1.item.id.uuidString) }
    }
}
