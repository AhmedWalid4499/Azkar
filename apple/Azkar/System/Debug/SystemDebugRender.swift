#if DEBUG
import AzkarKit
import SwiftUI
import WidgetKit

/// `-SystemDebugRender`: draws every widget family and the Live Activity's presentations with the
/// real views and today's real data, in light and dark, English and Arabic, and at a large text size,
/// into Documents/system-render/ (for checking them without placing widgets by hand).
enum SystemDebugRender {
    struct Variant {
        let name: String
        let language: SystemLanguage
        let scheme: ColorScheme
        let type: DynamicTypeSize
    }

    static let variants = [
        Variant(name: "en-light", language: SystemLanguage(code: "en"), scheme: .light, type: .large),
        Variant(name: "en-dark", language: SystemLanguage(code: "en"), scheme: .dark, type: .large),
        Variant(name: "ar-light", language: SystemLanguage(code: "ar"), scheme: .light, type: .large),
        Variant(name: "ar-dark", language: SystemLanguage(code: "ar", arabicDigits: true), scheme: .dark, type: .large),
        Variant(name: "en-xxxl", language: SystemLanguage(code: "en"), scheme: .light, type: .xxxLarge),
    ]

    static func run() async {
        let (settings, board) = await SystemServices.shared.currentBoard()
        let folder = URL.documentsDirectory.appending(path: "system-render", directoryHint: .isDirectory)
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let sample = PrayerTimesEntry.sample()
        for variant in variants {
            var language = variant.language
            language.uses24Hour = settings.app.timeFormat == .twentyFourHour
            let entry: PrayerTimesEntry
            if let board {
                entry = PrayerTimesEntry(date: board.now, language: language, name: settings.app.name, content: .ready(board), azkar: sample.azkar)
            } else {
                entry = PrayerTimesEntry(date: .now, language: language, name: "", content: .noLocation, azkar: [])
            }
            for (family, size) in families {
                save(widget(entry, family), size: size, variant, to: folder.appending(path: "widget-\(family)-\(variant.name).png"))
            }
            for (name, quran) in [("quran", QuranWidgetEntry.sample(language: language)), ("quran-ramadan", QuranWidgetEntry.sample(language: language, inRamadan: true))] {
                save(home(QuranWidgetSmallView(entry: quran), CGSize(width: 170, height: 170)), size: CGSize(width: 170, height: 170), variant, to: folder.appending(path: "\(name)-small-\(variant.name).png"))
                save(home(QuranWidgetMediumView(entry: quran), CGSize(width: 364, height: 170)), size: CGSize(width: 364, height: 170), variant, to: folder.appending(path: "\(name)-medium-\(variant.name).png"))
                save(QuranWidgetRectangularView(entry: quran).frame(width: 172, height: 76).background(.gray.opacity(0.3), in: .rect(cornerRadius: 12)),
                     size: CGSize(width: 172, height: 76), variant, to: folder.appending(path: "\(name)-rectangular-\(variant.name).png"))
            }
            save(WidgetNoLocationView(language: language).padding(16).frame(width: 170, height: 170).background(WidgetBackdrop()).clipShape(.rect(cornerRadius: 22)),
                 size: CGSize(width: 170, height: 170), variant, to: folder.appending(path: "widget-empty-\(variant.name).png"))
            if let board, let state = NextPrayerAttributes.ContentState(board: board, language: language) {
                save(lockScreen(state), size: CGSize(width: 374, height: 170), variant, to: folder.appending(path: "activity-lock-\(variant.name).png"))
                save(island(state, language), size: CGSize(width: 374, height: 200), variant, to: folder.appending(path: "activity-island-\(variant.name).png"))
                var stale = state
                stale.at = .now.addingTimeInterval(-60)
                save(LiveActivityLockScreenView(state: stale, isStale: true).frame(width: 374).background(Color.azkarAccent.opacity(0.25)).clipShape(.rect(cornerRadius: 24)),
                     size: CGSize(width: 374, height: 170), variant, to: folder.appending(path: "activity-stale-\(variant.name).png"))
            }
        }
        print("SystemDebug: rendered into \(folder.path(percentEncoded: false))")
    }

    static let families: [(String, CGSize)] = [
        ("small", CGSize(width: 170, height: 170)), ("medium", CGSize(width: 364, height: 170)), ("large", CGSize(width: 364, height: 382)),
        ("circular", CGSize(width: 76, height: 76)), ("rectangular", CGSize(width: 172, height: 76)), ("inline", CGSize(width: 257, height: 26)),
    ]

    @ViewBuilder
    static func widget(_ entry: PrayerTimesEntry, _ family: String) -> some View {
        if let board = entry.board, let next = board.next {
            let language = entry.language
            switch family {
            case "small": home(WidgetSmallView(board: board, next: next, language: language), CGSize(width: 170, height: 170))
            case "medium": home(WidgetMediumView(board: board, next: next, language: language), CGSize(width: 364, height: 170))
            case "large": home(WidgetLargeView(entry: entry, board: board, next: next), CGSize(width: 364, height: 382))
            case "circular": WidgetCircularView(board: board, next: next, language: language).frame(width: 76, height: 76).background(Circle().fill(.gray.opacity(0.3)))
            case "rectangular": WidgetRectangularView(board: board, next: next, language: language).frame(width: 172, height: 76).background(.gray.opacity(0.3), in: .rect(cornerRadius: 12))
            default: WidgetInlineView(board: board, next: next, language: language).frame(width: 257, height: 26)
            }
        }
    }

    static func home(_ content: some View, _ size: CGSize) -> some View {
        content.padding(16).frame(width: size.width, height: size.height).background(WidgetBackdrop()).clipShape(.rect(cornerRadius: 22))
    }

    static func lockScreen(_ state: NextPrayerAttributes.ContentState) -> some View {
        LiveActivityLockScreenView(state: state, isStale: false)
            .frame(width: 374)
            .background(Color.azkarAccent.opacity(0.25))
            .clipShape(.rect(cornerRadius: 24))
    }

    /// The compact and expanded Dynamic Island, drawn the way the system lays them out.
    static func island(_ state: NextPrayerAttributes.ContentState, _ language: SystemLanguage) -> some View {
        VStack(spacing: 12) {
            HStack {
                Image(systemName: state.prayer.symbolName).foregroundStyle(.tint)
                Spacer()
                LiveActivityCompactCountdown(state: state, isStale: false)
            }
            .padding(.horizontal, 14)
            .frame(width: 250, height: 37)
            .background(.black, in: .capsule)
            VStack(spacing: 10) {
                HStack {
                    Label(SystemText.prayer(state.prayer, language), systemImage: state.prayer.symbolName).font(.headline)
                    Spacer()
                    Text(verbatim: SystemText.time(state.at, in: state.timeZone, language)).font(.headline.monospacedDigit())
                }
                LiveActivityCountdown(state: state, isStale: false)
            }
            .padding(18)
            .frame(width: 370)
            .background(.black, in: .rect(cornerRadius: 40))
        }
        .foregroundStyle(.white)
        .environment(\.colorScheme, .dark)
    }

    static func save(_ view: some View, size: CGSize, _ variant: Variant, to url: URL) {
        let content = view
            .tint(.azkarAccent)
            .systemLanguage(variant.language)
            .environment(\.colorScheme, variant.scheme)
            .environment(\.dynamicTypeSize, variant.type)
            .padding(8)
            .background(variant.scheme == .dark ? Color.black : Color(white: 0.92))
        let renderer = ImageRenderer(content: content)
        renderer.scale = 3
        guard let image = renderer.uiImage, let data = image.pngData() else { return print("SystemDebug: could not render \(url.lastPathComponent)") }
        try? data.write(to: url)
    }
}
#endif
