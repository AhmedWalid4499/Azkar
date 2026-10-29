import AzkarKit
import SwiftUI

/// The Azkar tab: the session picker, the reader and the tasbih counter. Open a session from
/// elsewhere with `ReadingRouter.shared.open(_:)`.
struct ReadingScreen: View {
    @Environment(AppEnvironment.self) private var app
    @State private var context: ReadingContext?
    private let router: ReadingRouter

    init(router: ReadingRouter = .shared) {
        self.router = router
    }

    var body: some View {
        if let context {
            ReadingStack(router: router)
                .environment(context)
        } else {
            // Made once the app's environment can be read; an empty view would never appear.
            Color.clear.onAppear(perform: makeContext)
        }
    }

    private func makeContext() {
        guard context == nil else { return }
        #if DEBUG
        let made = ReadingDebug.context(app) ?? ReadingContext(app)
        context = made
        ReadingDebug.launch(made, router: router)
        #else
        context = ReadingContext(app)
        #endif
    }
}

/// The tab's navigation stack, with the interface's digits and clock applied to everything in it.
private struct ReadingStack: View {
    @Bindable var router: ReadingRouter
    @Environment(ReadingContext.self) private var context
    @Environment(\.locale) private var locale

    var body: some View {
        let settings = context.settings.settings
        let reading = ReadingLocale(locale: locale, app: settings.app, timeZone: settings.timeZone)
        NavigationStack(path: $router.path) {
            SessionPickerView()
                .navigationDestination(for: ReadingDestination.self) { destination in
                    switch destination {
                    case let .session(session, requested):
                        let day = requested ?? ReadingClock(now: .now, settings: settings).day(for: session)
                        ReaderView(session: session, day: day, context: context)
                            .id("\(session)-\(day)")
                    case .tasbih:
                        TasbihView(context: context)
                    }
                }
        }
        .environment(\.readingLocale, reading)
        .environment(\.locale, reading.formatting)
    }
}

/// Shows a Reading view over a throwaway in-memory store, for `#Preview`s.
struct ReadingPreview<Content: View>: View {
    @ViewBuilder let content: () -> Content
    @State private var context: ReadingContext? = {
        let dataset = AzkarDataset.bundled
        guard let store = try? RecordStore.open(.inMemory, catalog: DatasetCatalog(dataset)) else { return nil }
        let defaults = UserDefaults(suiteName: "ReadingPreview") ?? .standard
        return ReadingContext(dataset: dataset, records: RecordsModel(store: store), settings: SettingsModel(store: SettingsStore(defaults: defaults, postsNotifications: false)))
    }()

    var body: some View {
        if let context {
            NavigationStack { content() }.environment(context)
        }
    }
}

#Preview {
    ReadingPreview { SessionPickerView() }
}
