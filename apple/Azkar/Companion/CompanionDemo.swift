#if DEBUG
import AzkarKit
import Foundation

/// Debug builds only: `-AzkarCompanion open` opens the companion at launch, and
/// `-AzkarCompanionDemo YES` fills it with a sample conversation, so its screens can be checked in
/// a simulator without an API key or a request.
enum CompanionDemo {
    static var opens: Bool { UserDefaults.standard.string(forKey: "AzkarCompanion") == "open" }

    @MainActor
    static func applyIfRequested(to model: CompanionModel) {
        guard UserDefaults.standard.bool(forKey: "AzkarCompanionDemo") else { return }
        model.hasKey = true
        let messages: [JSONValue] = [
            ["role": "user", "content": [["type": "text", "text": "<context>Demo</context>"], ["type": "text", "text": "I feel anxious and can’t calm down"]]],
            ["role": "assistant", "content": [
                ["type": "text", "text": "I’m sorry you’re carrying this right now. Anxiety can feel like it fills everything, but you came here, and that is already a step toward calm."],
                ["type": "tool_use", "id": "demo-1", "name": "show_quran", "input": ["surah": 13, "from_ayah": 28, "to_ayah": 28]],
                ["type": "tool_use", "id": "demo-2", "name": "show_dua", "input": ["id": "worry_and_grief-2"]],
            ]],
            ["role": "user", "content": [
                ["type": "tool_result", "tool_use_id": "demo-1", "content": "Shown"],
                ["type": "tool_result", "tool_use_id": "demo-2", "content": "Shown"],
            ]],
            ["role": "assistant", "content": [["type": "text", "text": "Read the verse slowly, then say the dua below. Take a few slow breaths between them."]]],
        ]
        model.open(CompanionConversation(startedAt: .now, messages: messages))
    }
}
#endif
