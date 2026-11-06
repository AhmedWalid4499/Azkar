import AzkarKit
import Foundation
import Observation

/// The conversation on screen and the one request under way. Conversations are saved with the
/// records after every reply, so a reply is never lost once it has arrived.
@MainActor
@Observable
final class CompanionModel {
    private let app: AppEnvironment
    /// `nil` until the person has written: a new conversation is saved only once it has a reply.
    private(set) var conversation: CompanionConversation?
    private(set) var isReplying = false
    private(set) var failure: CompanionError?
    /// What the person sent last, kept for "Try again" when the reply failed.
    private(set) var unsent: String?
    var hasKey = CompanionKey.load() != nil
    @ObservationIgnored private var task: Task<Void, Never>?

    init(app: AppEnvironment) {
        self.app = app
    }

    var lines: [CompanionLine] { conversation?.lines() ?? [] }

    func send(_ text: String) {
        let text = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !isReplying else { return }
        guard let key = CompanionKey.load() else {
            hasKey = false
            return
        }
        failure = nil
        unsent = text
        isReplying = true
        let current = conversation ?? CompanionConversation(startedAt: .now)
        let context = contextNote()
        task = Task {
            defer { isReplying = false }
            do {
                let replied = try await CompanionClient(apiKey: key).reply(to: text, in: current, context: context)
                conversation = replied
                unsent = nil
                try? await app.records.saveCompanion(replied)
            } catch is CancellationError {
                return
            } catch let error as CompanionError {
                failure = error
                if error == .missingKey { hasKey = false }
            } catch {
                failure = .offline
            }
        }
    }

    func retry() {
        guard let unsent else { return }
        send(unsent)
    }

    func startOver() {
        task?.cancel()
        conversation = nil
        failure = nil
        unsent = nil
        isReplying = false
    }

    func open(_ conversation: CompanionConversation) {
        startOver()
        self.conversation = conversation
    }

    func delete(_ conversation: CompanionConversation) {
        if self.conversation?.id == conversation.id { startOver() }
        Task { try? await app.records.deleteCompanion(conversation.id) }
    }

    func stop() {
        task?.cancel()
        isReplying = false
    }

    /// The day, the time and the person's name, in English for Claude; the reply follows the
    /// language the person writes in.
    private func contextNote() -> String {
        let settings = app.settings.settings
        let zone = settings.timeZone
        let now = Date.now
        let today = DayKey(now, in: zone)
        let english = Locale(identifier: "en_US_POSIX")
        let day = now.formatted(Date.FormatStyle(date: .complete, time: .omitted, locale: english, timeZone: zone))
        let time = now.formatted(Date.FormatStyle(date: .omitted, time: .shortened, locale: english, timeZone: zone))
        let hijri = HijriFormat.full(today, offset: settings.app.hijriOffset, locale: DisplayLocale(language: .en, arabicIndicDigits: false))
        var parts = ["Today is \(day) (\(hijri)), and it is \(time) where they are."]
        if !settings.app.name.isEmpty { parts.append("Their name is \(settings.app.name).") }
        return parts.joined(separator: " ")
    }
}
