import AzkarCore
import Foundation

// The companion's conversations: kept with the records so that backups, restores and erasing take
// them along, but outside any day, and out of the spreadsheet export.

extension RecordStore {
    /// Every conversation, the latest first.
    public func companionConversations() throws -> [CompanionConversation] {
        try rows().companionConversations()
    }

    /// Saves a conversation, replacing the stored copy of the same id.
    public func saveCompanion(_ conversation: CompanionConversation, at now: Date = .now) throws -> RecordChange {
        try change(today(at: now)) { rows in
            let text = conversation.encodedMessages
            if let row = try rows.companion(conversation.id) {
                guard row.messages != text || row.updatedAt != conversation.updatedAt else { return (.unchanged, [:]) }
                row.messages = text
                row.updatedAt = conversation.updatedAt
            } else {
                rows.insert(conversation)
            }
            return (.changed, [:])
        }
    }

    /// Deletes a conversation. An id not stored changes nothing.
    public func deleteCompanion(_ id: UUID, at now: Date = .now) throws -> RecordChange {
        try change(today(at: now)) { rows in
            guard let row = try rows.companion(id) else { return (.unchanged, [:]) }
            rows.context.delete(row)
            return (.changed, [:])
        }
    }
}

extension RecordRows {
    func companion(_ id: UUID) throws -> CompanionRow? {
        try fetch(#Predicate<CompanionRow> { $0.id == id }).first
    }

    /// The latest first; a row whose messages cannot be read is skipped, never deleted.
    func companionConversations() throws -> [CompanionConversation] {
        let rows: [CompanionRow] = try fetch()
        return rows.compactMap { row in
            CompanionConversation.messages(from: row.messages).map {
                CompanionConversation(id: row.id, startedAt: row.startedAt.nearestMillisecond, updatedAt: row.updatedAt.nearestMillisecond, messages: $0)
            }
        }
        .sorted { ($0.updatedAt, $0.id.uuidString) > ($1.updatedAt, $1.id.uuidString) }
    }

    func insert(_ conversation: CompanionConversation) {
        context.insert(CompanionRow(id: conversation.id, startedAt: conversation.startedAt, updatedAt: conversation.updatedAt, messages: conversation.encodedMessages))
    }
}
