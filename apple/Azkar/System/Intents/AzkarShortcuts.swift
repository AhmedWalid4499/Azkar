import AppIntents

/// What Siri, Spotlight and the Shortcuts app offer without any setup. The Arabic phrases are in
/// AppShortcuts.xcstrings.
nonisolated struct AzkarShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: LogPrayerIntent(),
            phrases: [
                "Log \(\.$prayer) in \(.applicationName)",
                "I prayed \(\.$prayer) in \(.applicationName)",
                "Log a prayer in \(.applicationName)",
            ],
            shortTitle: LocalizedStringResource("Log a Prayer", table: "System"),
            systemImageName: "checkmark.circle"
        )
        AppShortcut(
            intent: LogCurrentPrayerIntent(),
            phrases: [
                "Log the current prayer in \(.applicationName)",
                "I prayed in \(.applicationName)",
            ],
            shortTitle: LocalizedStringResource("Log Current Prayer", table: "System"),
            systemImageName: "checkmark.circle.badge.plus"
        )
        AppShortcut(
            intent: NextPrayerIntent(),
            phrases: [
                "When is the next prayer in \(.applicationName)",
                "Next prayer in \(.applicationName)",
                "What’s the next prayer in \(.applicationName)",
            ],
            shortTitle: LocalizedStringResource("Next Prayer", table: "System"),
            systemImageName: "clock"
        )
        AppShortcut(
            intent: OpenAzkarSessionIntent(),
            phrases: [
                "Open \(\.$session) in \(.applicationName)",
                "Read \(\.$session) in \(.applicationName)",
                "Read azkar in \(.applicationName)",
            ],
            shortTitle: LocalizedStringResource("Open Azkar Session", table: "System"),
            systemImageName: "book"
        )
        AppShortcut(
            intent: OpenQiblaIntent(),
            phrases: [
                "Open Qibla in \(.applicationName)",
                "Show the Qibla in \(.applicationName)",
            ],
            shortTitle: LocalizedStringResource("Open Qibla", table: "System"),
            systemImageName: "location.north.line"
        )
    }
}
