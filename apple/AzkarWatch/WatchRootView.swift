import AzkarCore
import SwiftUI

/// The two pages, in the language the iPhone's app is set to.
struct WatchRootView: View {
    let store: WatchStore

    var body: some View {
        TabView {
            WatchPrayersView(store: store)
            WatchTasbihView(store: store)
        }
        .tabViewStyle(.verticalPage)
        .environment(\.locale, locale)
        .environment(\.layoutDirection, store.board?.languageCode == "ar" ? .rightToLeft : .leftToRight)
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
