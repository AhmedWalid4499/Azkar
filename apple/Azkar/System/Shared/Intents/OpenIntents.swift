import AppIntents
import AzkarKit
import Foundation

// Intents that bring the app forward at a place. They run in the app (foreground mode), which
// hands the place to `SystemRouter`. Shared by the app and the widget extension (the controls use them).

/// "Open the morning azkar in Azkar."
struct OpenAzkarSessionIntent: AppIntent {
    static let title = LocalizedStringResource("Open Azkar Session", table: "System")
    static let description = IntentDescription(LocalizedStringResource("Opens the reader at a session of azkar.", table: "System"))
    static let supportedModes: IntentModes = .foreground(.immediate)

    @Parameter(title: LocalizedStringResource("Azkar", table: "System"))
    var session: SessionChoice

    init() {}

    init(session: SessionChoice) {
        self.session = session
    }

    func perform() async throws -> some IntentResult {
        let route = SystemRoute.azkar(session.session)
        await MainActor.run { SystemRouter.shared.go(route) }
        return .result()
    }
}

/// "Open Qibla in Azkar."
struct OpenQiblaIntent: AppIntent {
    static let title = LocalizedStringResource("Open Qibla", table: "System")
    static let description = IntentDescription(LocalizedStringResource("Shows the direction of the Kaaba.", table: "System"))
    static let supportedModes: IntentModes = .foreground(.immediate)

    init() {}

    func perform() async throws -> some IntentResult {
        await MainActor.run { SystemRouter.shared.go(.qibla) }
        return .result()
    }
}

/// Opens Today, from the Live Activity and the adhan alarm.
struct OpenTodayIntent: AppIntent {
    static let title = LocalizedStringResource("Open Today", table: "System")
    static let isDiscoverable = false
    static let supportedModes: IntentModes = .foreground(.immediate)

    init() {}

    func perform() async throws -> some IntentResult {
        await MainActor.run { SystemRouter.shared.go(.today) }
        return .result()
    }
}
