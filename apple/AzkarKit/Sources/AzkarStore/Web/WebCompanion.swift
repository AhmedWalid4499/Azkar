import AzkarCore
import Foundation

/// The companion's conversations in a backup (`azkar:companion`), a store the website does not
/// have: `conversations` of `{ id, startedAt, updatedAt, messages }`, times in milliseconds and
/// `messages` exactly as exchanged with Claude. What cannot be read is skipped, one at a time.
enum WebCompanion {
    static let version = 1

    static func read(_ value: JSONValue?) -> [CompanionConversation] {
        var conversations: [UUID: CompanionConversation] = [:]
        for stored in value?["conversations"]?.array ?? [] {
            guard let id = stored["id"]?.string.flatMap(UUID.init(uuidString:)), conversations[id] == nil,
                  let startedAt = WebRules.timestamp(stored["startedAt"]),
                  let messages = stored["messages"]?.array
            else { continue }
            let updatedAt = WebRules.timestamp(stored["updatedAt"]) ?? startedAt
            conversations[id] = CompanionConversation(id: id, startedAt: startedAt, updatedAt: updatedAt, messages: messages)
        }
        return conversations.values.sorted { ($0.updatedAt, $0.id.uuidString) > ($1.updatedAt, $1.id.uuidString) }
    }

    static func web(_ conversations: [CompanionConversation]) -> JSONValue {
        ["conversations": .array(conversations.map { conversation -> JSONValue in
            [
                "id": .string(conversation.id.uuidString), "startedAt": JSONValue(ms: conversation.startedAt),
                "updatedAt": JSONValue(ms: conversation.updatedAt), "messages": .array(conversation.messages),
            ]
        })]
    }
}
