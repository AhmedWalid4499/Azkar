import AzkarContent
import AzkarCore
import AzkarStore
import Foundation
import Testing
@testable import Companion

/// Answers each request with the next scripted reply, and keeps what was sent.
final class ScriptedTransport: CompanionTransport, @unchecked Sendable {
    var replies: [(status: Int, body: JSONValue)]
    private(set) var sent: [JSONValue] = []
    private(set) var headers: [[String: String]] = []

    init(_ replies: [(status: Int, body: JSONValue)]) {
        self.replies = replies
    }

    func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        sent.append(try JSONDecoder().decode(JSONValue.self, from: request.httpBody ?? Data()))
        headers.append(request.allHTTPHeaderFields ?? [:])
        let reply = replies.removeFirst()
        let response = HTTPURLResponse(url: request.url!, statusCode: reply.status, httpVersion: nil, headerFields: nil)!
        return (try JSONEncoder().encode(reply.body), response)
    }
}

private func message(_ blocks: [JSONValue], stop: String) -> (status: Int, body: JSONValue) {
    (200, ["id": "msg_1", "type": "message", "role": "assistant", "content": .array(blocks), "stop_reason": .string(stop)])
}

@Suite struct CompanionToolTests {
    let tools = CompanionTools()

    @Test func theDuasComeFromTheBundledChaptersWordForWord() throws {
        let duas = ComfortDuas.bundled
        #expect(duas.topics.count == 22)
        let distress = try #require(duas.topic("distress"))
        #expect(distress.items.count == 4)
        #expect(distress.items.allSatisfy { !$0.text.isEmpty && !$0.reference.isEmpty })
        // Ids are unique across topics.
        let ids = duas.topics.flatMap(\.items).map(\.id)
        #expect(Set(ids).count == ids.count)
    }

    @Test func findingAndShowingADua() throws {
        let found = tools.run("find_duas", input: ["topic": "worry_and_grief"])
        #expect(!found.isError)
        #expect(found.result.contains("[worry_and_grief-1]"))
        let shown = tools.run("show_dua", input: ["id": "worry_and_grief-1"])
        guard case let .dua(dua, topic)? = shown.card else { Issue.record("no card"); return }
        #expect(topic.id == "worry_and_grief")
        #expect(shown.result.hasSuffix(dua.text))
        #expect(tools.run("show_dua", input: ["id": "made-up"]).isError)
        #expect(tools.run("find_duas", input: ["topic": "nothing"]).isError)
    }

    @Test func versesComeFromTheMushafAndStayWithinASurah() throws {
        let shown = tools.run("show_quran", input: ["surah": 94, "from_ayah": 5, "to_ayah": 6])
        guard case let .quran(sura, from, to, ayat)? = shown.card else { Issue.record("no card"); return }
        #expect((sura, from, to) == (94, 5, 6))
        let mushaf = QuranMushaf.bundled
        let expected = mushaf.ayat.filter { $0.sura == 94 && (5...6).contains($0.number) }
        #expect(ayat == expected)
        #expect(tools.run("show_quran", input: ["surah": 1, "from_ayah": 1, "to_ayah": 8]).isError)
        #expect(tools.run("show_quran", input: ["surah": 115, "from_ayah": 1, "to_ayah": 1]).isError)
        #expect(tools.run("show_quran", input: ["surah": 2, "from_ayah": 1, "to_ayah": 11]).isError)
        #expect(tools.run("show_quran", input: ["surah": 2, "from_ayah": 1.5, "to_ayah": 2]).isError)
        #expect(tools.run("show_quran", input: ["surah": 2, "from_ayah": 3, "to_ayah": 2]).isError)
    }

    @Test func theToolsAreStrictAndTheirTopicsAreTheBundledOnes() {
        let definitions = tools.definitions
        #expect(definitions.map { $0["name"]?.string } == ["find_duas", "show_dua", "show_quran"])
        #expect(definitions.allSatisfy { $0["strict"] == true && $0["input_schema"]?["additionalProperties"] == false })
        #expect(definitions[0]["input_schema"]?["properties"]?["topic"]?["enum"]?.array?.count == ComfortDuas.bundled.topics.count)
    }
}

@Suite struct CompanionClientTests {
    let start = Date(timeIntervalSince1970: 1_800_000_000)

    @Test func aReplyWithAVerseRunsTheToolAndShowsTheCard() async throws {
        let transport = ScriptedTransport([
            message([
                ["type": "thinking", "thinking": "", "signature": "sig-1"],
                ["type": "text", "text": "I hear you."],
                ["type": "tool_use", "id": "toolu_1", "name": "show_quran", "input": ["surah": 94, "from_ayah": 5, "to_ayah": 6]],
            ], stop: "tool_use"),
            message([["type": "text", "text": "Read the verses below slowly."]], stop: "end_turn"),
        ])
        let client = CompanionClient(apiKey: "test-key", transport: transport)
        let conversation = try await client.reply(to: "I'm scared", in: CompanionConversation(startedAt: start), context: "Friday", at: start)

        // The person's message, the reply, the tool's result, the reply's end.
        #expect(conversation.messages.map { $0["role"]?.string } == ["user", "assistant", "user", "assistant"])
        // The first message opens with the context note, kept out of what the screen shows.
        #expect(conversation.messages[0]["content"]?.array?.first?["text"]?.string == "<context>Friday</context>")
        let result = try #require(conversation.messages[2]["content"]?.array?.first)
        #expect(result["type"] == "tool_result" && result["tool_use_id"] == "toolu_1" && result["is_error"] == nil)

        let lines = conversation.lines()
        #expect(lines.map(\.role) == [.person, .companion])
        #expect(lines[0].text == "I'm scared")
        #expect(lines[1].text == "I hear you.\n\nRead the verses below slowly.")
        #expect(lines[1].cards.count == 1)
        #expect(conversation.title == "I'm scared")

        // The second request sends the first reply back as it came, thinking included.
        let second = try #require(transport.sent.last)
        #expect(second["messages"]?.array?[1] == conversation.messages[1])
    }

    @Test func theRequestFollowsTheAPI() async throws {
        let transport = ScriptedTransport([message([["type": "text", "text": "Salam"]], stop: "end_turn")])
        _ = try await CompanionClient(apiKey: "test-key", transport: transport).reply(to: "Hi", in: CompanionConversation(startedAt: start), context: "", at: start)
        let body = try #require(transport.sent.first)
        #expect(body["model"] == "claude-opus-5-5")
        #expect(body["fallbacks"] == "default")
        #expect(body["output_config"]?["effort"] == "medium")
        #expect(body["thinking"] == nil && body["temperature"] == nil)
        #expect(body["cache_control"]?["type"] == "ephemeral")
        #expect(body["system"]?.string == CompanionPrompt.system)
        let headers = try #require(transport.headers.first)
        #expect(headers["x-api-key"] == "test-key")
        #expect(headers["anthropic-version"] == "2026-10-21")
        #expect(headers["anthropic-beta"] == "server-side-fallback-2026-07-01")
    }

    @Test func laterMessagesCarryNoContextAndEarlierOnesStayAsTheyWere() async throws {
        let transport = ScriptedTransport([
            message([["type": "text", "text": "One"]], stop: "end_turn"),
            message([["type": "text", "text": "Two"]], stop: "end_turn"),
        ])
        let client = CompanionClient(apiKey: "k", transport: transport)
        let first = try await client.reply(to: "a", in: CompanionConversation(startedAt: start), context: "c", at: start)
        let second = try await client.reply(to: "b", in: first, context: "c", at: start.addingTimeInterval(60))
        #expect(Array(second.messages.prefix(first.messages.count)) == first.messages)
        #expect(second.messages[2]["content"]?.array?.count == 1)
        #expect(second.updatedAt == start.addingTimeInterval(60))
        #expect(second.lines().map(\.text) == ["a", "One", "b", "Two"])
    }

    @Test func failuresLeaveTheConversationUnchanged() async throws {
        let cases: [((status: Int, body: JSONValue), CompanionError)] = [
            ((401, ["type": "error", "error": ["type": "authentication_error", "message": "invalid x-api-key"]]), .invalidKey),
            ((429, ["type": "error", "error": ["type": "rate_limit_error", "message": "slow down"]]), .rateLimited),
            ((529, ["type": "error", "error": ["type": "overloaded_error", "message": "busy"]]), .overloaded),
            ((400, ["type": "error", "error": ["type": "invalid_request_error", "message": "bad"]]), .server(status: 400, message: "bad")),
            (message([], stop: "refusal"), .declined),
            (message([], stop: "end_turn"), .unreadableResponse),
        ]
        for (reply, expected) in cases {
            let client = CompanionClient(apiKey: "k", transport: ScriptedTransport([reply]))
            await #expect(throws: expected) {
                try await client.reply(to: "hi", in: CompanionConversation(startedAt: start), context: "", at: start)
            }
        }
        await #expect(throws: CompanionError.missingKey) {
            try await CompanionClient(apiKey: "", transport: ScriptedTransport([])).reply(to: "hi", in: CompanionConversation(startedAt: start), context: "", at: start)
        }
    }

    @Test func aReplyThatNeverEndsIsCutOff() async throws {
        let call: JSONValue = ["type": "tool_use", "id": "t", "name": "find_duas", "input": ["topic": "distress"]]
        let transport = ScriptedTransport(Array(repeating: message([call], stop: "tool_use"), count: CompanionClient.maxRounds))
        await #expect(throws: CompanionError.tooManySteps) {
            try await CompanionClient(apiKey: "k", transport: transport).reply(to: "hi", in: CompanionConversation(startedAt: start), context: "", at: start)
        }
    }

    @Test func aMadeUpDuaIdComesBackAsAnErrorForClaudeToCorrect() async throws {
        let transport = ScriptedTransport([
            message([["type": "tool_use", "id": "t1", "name": "show_dua", "input": ["id": "invented-1"]]], stop: "tool_use"),
            message([["type": "text", "text": "Sorry."]], stop: "end_turn"),
        ])
        let conversation = try await CompanionClient(apiKey: "k", transport: transport).reply(to: "hi", in: CompanionConversation(startedAt: start), context: "", at: start)
        #expect(conversation.messages[2]["content"]?.array?.first?["is_error"] == true)
        #expect(conversation.lines().last?.cards.isEmpty == true)
    }
}

@Suite struct CompanionStoreTests {
    let start = Date(timeIntervalSince1970: 1_800_000_000)

    @Test func conversationsAreKeptWithTheRecordsAndInBackups() async throws {
        let store = try RecordStore.open(.inMemory, catalog: StaticSessionCatalog.empty, timeZone: { TimeZone(identifier: "UTC")! })
        var conversation = CompanionConversation(startedAt: start, messages: [["role": "user", "content": [["type": "text", "text": "Salam"]]]])
        _ = try await store.saveCompanion(conversation, at: start)
        conversation.messages.append(["role": "assistant", "content": [["type": "text", "text": "Wa alaykum as-salam"]]])
        conversation.updatedAt = start.addingTimeInterval(5)
        _ = try await store.saveCompanion(conversation, at: start)
        #expect(try await store.companionConversations() == [conversation])

        let records = try await store.snapshot()
        #expect(records.companion == [conversation])
        // Never part of a single day's records.
        #expect(try await store.days(from: DayKey(start, in: .gmt), to: DayKey(start, in: .gmt)).isEmpty)

        let data = Backup.export(records: records, settings: SettingsSnapshot(), at: start)
        let read = try Backup.read(data, catalog: StaticSessionCatalog.empty)
        #expect(read.snapshot.records.companion == [conversation])

        let other = try RecordStore.open(.inMemory, catalog: StaticSessionCatalog.empty)
        try await other.replaceAll(with: read.snapshot.records)
        try await other.merge(read.snapshot.records)
        #expect(try await other.companionConversations() == [conversation])

        _ = try await store.deleteCompanion(conversation.id, at: start)
        #expect(try await store.snapshot().isEmpty)
    }

    @Test func aBackupWithoutConversationsWritesNoStore() {
        let data = Backup.export(records: RecordsSnapshot(), settings: SettingsSnapshot(), at: start)
        #expect(!String(decoding: data, as: UTF8.self).contains("azkar:companion"))
    }
}
