import AzkarStore
import Foundation

/// Why a reply could not be had. The conversation is left as it was, so the person can try again.
public enum CompanionError: Error, Hashable, Sendable {
    case missingKey
    /// The API key was refused.
    case invalidKey
    /// Too many requests, or the account is out of credit or limits.
    case rateLimited
    case overloaded
    /// No connection, or it timed out.
    case offline
    /// Claude declined to answer this.
    case declined
    /// Claude kept calling tools without finishing a reply.
    case tooManySteps
    case server(status: Int, message: String?)
    case unreadableResponse
}

/// Sends one request and returns the reply's body and status. Tests replace it.
public protocol CompanionTransport: Sendable {
    func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse)
}

/// The Claude API over HTTPS.
public struct URLSessionTransport: CompanionTransport {
    private let session: URLSession

    public init() {
        let configuration = URLSessionConfiguration.ephemeral
        // A reply that thinks before answering can take a while.
        configuration.timeoutIntervalForRequest = 180
        configuration.timeoutIntervalForResource = 300
        session = URLSession(configuration: configuration)
    }

    public func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw CompanionError.unreadableResponse }
        return (data, http)
    }
}

/// Talks to Claude for the companion: one person's message in, the conversation with Claude's reply out.
public struct CompanionClient: Sendable {
    public static let endpoint = URL(string: "https://api.anthropic.com/v1/messages")!
    public static let model = "claude-opus-5-5"
    static let apiVersion = "2026-10-21"
    /// Lets a request Claude's safety checks decline be answered by the model Anthropic recommends instead.
    static let fallbackBeta = "server-side-fallback-2026-07-01"
    /// Rounds of tool calls in one reply, at most.
    static let maxRounds = 6

    let apiKey: String
    let transport: any CompanionTransport
    let tools: CompanionTools

    public init(apiKey: String, transport: any CompanionTransport = URLSessionTransport(), tools: CompanionTools = CompanionTools()) {
        self.apiKey = apiKey
        self.transport = transport
        self.tools = tools
    }

    /// `conversation` with the person's `text` and Claude's reply added. `context` opens the first
    /// message only. Nothing earlier is ever changed; on any failure nothing is added at all.
    public func reply(to text: String, in conversation: CompanionConversation, context: String, at now: Date = .now) async throws -> CompanionConversation {
        guard !apiKey.isEmpty else { throw CompanionError.missingKey }
        var messages = conversation.messages
        var content: [JSONValue] = []
        if messages.isEmpty { content.append(["type": "text", "text": .string(CompanionPrompt.context(context))]) }
        content.append(["type": "text", "text": .string(text)])
        messages.append(["role": "user", "content": .array(content)])

        for _ in 0..<Self.maxRounds {
            let response = try await send(messages)
            guard let blocks = response["content"]?.array else { throw CompanionError.unreadableResponse }
            let stop = response["stop_reason"]?.string
            if stop == "refusal" { throw CompanionError.declined }
            // An empty reply can't be sent back later; treat it as no reply.
            guard !blocks.isEmpty else { throw CompanionError.unreadableResponse }
            messages.append(["role": "assistant", "content": .array(blocks)])

            guard stop == "tool_use" else {
                var done = conversation
                done.messages = messages
                done.updatedAt = now
                return done
            }
            // Every call gets its result, all in one message.
            let results: [JSONValue] = blocks.filter { $0["type"]?.string == "tool_use" }.map { call in
                let outcome = tools.run(call["name"]?.string ?? "", input: call["input"] ?? .null)
                var result: [String: JSONValue] = ["type": "tool_result", "tool_use_id": call["id"] ?? .null, "content": .string(outcome.result)]
                if outcome.isError { result["is_error"] = true }
                return .object(result)
            }
            guard !results.isEmpty else { throw CompanionError.unreadableResponse }
            messages.append(["role": "user", "content": .array(results)])
        }
        throw CompanionError.tooManySteps
    }

    func request(_ messages: [JSONValue]) throws -> URLRequest {
        let body: JSONValue = [
            "model": .string(Self.model),
            "max_tokens": 16000,
            "system": .string(CompanionPrompt.system),
            "tools": .array(tools.definitions),
            "messages": .array(messages),
            // Thinking is always on for this model; medium effort keeps replies prompt.
            "output_config": ["effort": "medium"],
            "fallbacks": "default",
            // Caches the instructions, the tools and the conversation so far for the next turn.
            "cache_control": ["type": "ephemeral"],
        ]
        var request = URLRequest(url: Self.endpoint)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "content-type")
        request.setValue(apiKey, forHTTPHeaderField: "x-api-key")
        request.setValue(Self.apiVersion, forHTTPHeaderField: "anthropic-version")
        request.setValue(Self.fallbackBeta, forHTTPHeaderField: "anthropic-beta")
        request.httpBody = try JSONEncoder().encode(body)
        return request
    }

    private func send(_ messages: [JSONValue]) async throws -> JSONValue {
        let data: Data
        let response: HTTPURLResponse
        do {
            (data, response) = try await transport.send(try request(messages))
        } catch let error as CompanionError {
            throw error
        } catch let error as URLError {
            throw error.code == .cancelled ? CancellationError() as any Error : CompanionError.offline
        } catch is CancellationError {
            throw CancellationError()
        } catch {
            throw CompanionError.offline
        }
        let json = try? JSONDecoder().decode(JSONValue.self, from: data)
        switch response.statusCode {
        case 200:
            guard let json else { throw CompanionError.unreadableResponse }
            return json
        case 401: throw CompanionError.invalidKey
        case 429: throw CompanionError.rateLimited
        case 529: throw CompanionError.overloaded
        default: throw CompanionError.server(status: response.statusCode, message: json?["error"]?["message"]?.string)
        }
    }
}
