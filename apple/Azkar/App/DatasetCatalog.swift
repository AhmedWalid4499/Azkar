import AzkarKit

/// The dataset's sessions as the records layer needs them: each session's azkar with
/// the count for that session (after-prayer counts differ by prayer), and the tasbih presets.
struct DatasetCatalog: SessionCatalog {
    let sessions: [AzkarSession: [DhikrTarget]]
    let tasbihPresets: [String]

    init(_ dataset: AzkarDataset) {
        var sessions: [AzkarSession: [DhikrTarget]] = [:]
        for session in AzkarSession.all {
            sessions[session] = dataset.azkar(for: session).map { DhikrTarget(id: $0.id, target: $0.repeat) }
        }
        self.sessions = sessions
        tasbihPresets = dataset.tasbihPresets.map(\.id)
    }

    func items(for session: AzkarSession) -> [DhikrTarget] { sessions[session] ?? [] }
}
