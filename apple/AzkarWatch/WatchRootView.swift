import AzkarCore
import SwiftUI

/// The two pages, in the language the iPhone's app is set to.
struct WatchRootView: View {
    let store: WatchStore
    @State private var page = WatchRootView.startPage

    private enum Page { case prayers, tasbih }

    var body: some View {
        TabView(selection: $page) {
            WatchPrayersView(store: store).tag(Page.prayers)
            WatchTasbihView(store: store).tag(Page.tasbih)
        }
        .tabViewStyle(.verticalPage)
        .environment(\.locale, locale)
        // Times are shown on the saved place's clock, as on the iPhone.
        .environment(\.timeZone, store.board?.zone ?? .current)
        .environment(\.layoutDirection, store.board?.languageCode == "ar" ? .rightToLeft : .leftToRight)
    }

    private static var startPage: Page {
        #if DEBUG
        if WatchDebug.startsOnTasbih { return .tasbih }
        #endif
        return .prayers
    }

    private var locale: Locale {
        guard let board = store.board else { return .current }
        var components = Locale.Components(languageCode: Locale.LanguageCode(board.languageCode), languageRegion: Locale.current.region)
        if board.languageCode == "ar" { components.numberingSystem = board.arabicDigits ? "arab" : "latn" }
        components.hourCycle = board.uses24Hour ? .zeroToTwentyThree : .oneToTwelve
        return Locale(components: components)
    }
}

extension Prayer {
    var title: LocalizedStringResource {
        switch self {
        case .fajr: LocalizedStringResource("Fajr", table: "Watch")
        case .dhuhr: LocalizedStringResource("Dhuhr", table: "Watch")
        case .asr: LocalizedStringResource("Asr", table: "Watch")
        case .maghrib: LocalizedStringResource("Maghrib", table: "Watch")
        case .isha: LocalizedStringResource("Isha", table: "Watch")
        }
    }
}
