import AzkarStore
import Foundation

/// One bubble of a conversation as the screen shows it.
public struct CompanionLine: Hashable, Sendable, Identifiable {
    public enum Role: Hashable, Sendable {
        case person
        case companion
    }

    /// Its position in the conversation.
    public var id: Int
    public var role: Role
    public var text: String
    public var cards: [CompanionCard]

    public init(id: Int, role: Role, text: String, cards: [CompanionCard]) {
        self.id = id
        self.role = role
        self.text = text
        self.cards = cards
    }
}

extension CompanionConversation {
    /// What the screen shows, worked out from the messages: what the person wrote (the app's
    /// context note left out), and each reply with the cards its tool calls showed. The rounds of
    /// one reply (text, tool calls, more text) make one bubble.
    public func lines(tools: CompanionTools = CompanionTools()) -> [CompanionLine] {
        var lines: [CompanionLine] = []
        for message in messages {
            let blocks = message["content"]?.array ?? message["content"]?.string.map { [["type": "text", "text": .string($0)]] } ?? []
            switch message["role"]?.string {
            case "user":
                let texts = blocks.filter { $0["type"]?.string == "text" }.compactMap { $0["text"]?.string }
                    .filter { !CompanionPrompt.isContext($0) }
                guard !texts.isEmpty else { continue }
                lines.append(CompanionLine(id: lines.count, role: .person, text: texts.joined(separator: "\n"), cards: []))
            case "assistant":
                if lines.last?.role != .companion {
                    lines.append(CompanionLine(id: lines.count, role: .companion, text: "", cards: []))
                }
                for block in blocks {
                    switch block["type"]?.string {
                    case "text":
                        let text = (block["text"]?.string ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
                        guard !text.isEmpty else { continue }
                        lines[lines.count - 1].text += (lines[lines.count - 1].text.isEmpty ? "" : "\n\n") + text
                    case "tool_use":
                        if let name = block["name"]?.string, let card = tools.card(name, input: block["input"] ?? .null) {
                            lines[lines.count - 1].cards.append(card)
                        }
                    default:
                        break
                    }
                }
            default:
                continue
            }
        }
        return lines
    }

    /// The first thing the person wrote, for the list of conversations.
    public var title: String? {
        lines().first { $0.role == .person }?.text
    }
}
