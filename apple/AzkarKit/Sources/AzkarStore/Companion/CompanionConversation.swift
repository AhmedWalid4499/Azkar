import Foundation

/// One conversation with the companion. `messages` is exactly what was exchanged with Claude, in
/// the shape of the Messages API (`{ role, content }`), so it can be sent back as it is: it is only
/// ever appended to, because Claude checks that earlier turns come back unchanged. What the screen
/// shows is worked out from it.
public struct CompanionConversation: Hashable, Sendable, Identifiable {
    public var id: UUID
    public var startedAt: Date
    public var updatedAt: Date
    public var messages: [JSONValue]

    public init(id: UUID = UUID(), startedAt: Date, updatedAt: Date? = nil, messages: [JSONValue] = []) {
        self.id = id
        self.startedAt = startedAt
        self.updatedAt = updatedAt ?? startedAt
        self.messages = messages
    }

    /// `messages` as stored: compact JSON.
    var encodedMessages: String {
        let data = (try? JSONEncoder().encode(messages)) ?? Data("[]".utf8)
        return String(decoding: data, as: UTF8.self)
    }

    static func messages(from text: String) -> [JSONValue]? {
        try? JSONDecoder().decode([JSONValue].self, from: Data(text.utf8))
    }
}
