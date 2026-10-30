import AzkarKit
import SwiftUI

/// The Quran tab: where you are, then every surah, juz and bookmark. A row opens the mushaf.
struct QuranScreen: View {
    @Environment(AppEnvironment.self) private var app
    @Environment(\.locale) private var baseLocale
    @AppStorage(QuranReaderView.lastPageKey) private var lastPage = 0
    @State private var mushaf: QuranMushaf?
    @State private var list = QuranList.suras
    @State private var request: QuranReaderRequest?
    @State private var showsPaper = false

    private enum QuranList: Hashable { case suras, juz, bookmarks }

    var body: some View {
        let settings = app.settings.settings
        let format = ReadingLocale(locale: baseLocale, app: settings.app, timeZone: settings.timeZone)
        NavigationStack {
            Group {
                if let mushaf {
                    content(mushaf)
                } else {
                    Color.clear
                }
            }
            .navigationTitle(Text(QL("Quran")))
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        showsPaper = true
                    } label: {
                        Label { Text(QL("I read from a paper mushaf")) } icon: { Image(systemName: "plus") }
                    }
                }
            }
        }
        .environment(\.locale, format.formatting)
        .environment(\.readingLocale, format)
        .fullScreenCover(item: $request) { request in
            if let mushaf {
                QuranReaderView(mushaf: mushaf, startPage: request.page)
                    .environment(\.locale, format.formatting)
                    .environment(\.readingLocale, format)
            }
        }
        .sheet(isPresented: $showsPaper) {
            if let mushaf {
                QuranPaperSheet(mushaf: mushaf)
                    .environment(\.locale, format.formatting)
                    .environment(\.readingLocale, format)
            }
        }
        .task {
            mushaf = await Task.detached(priority: .userInitiated) { QuranMushaf.bundled }.value
            #if DEBUG
            // `-AzkarQuranSeed`: some reading logged; `-AzkarQuranPage 50`: the mushaf open there.
            if UserDefaults.standard.bool(forKey: "AzkarQuranSeed"), app.records.records.quran.isEmpty {
                let today = DayKey(.now, in: app.settings.settings.timeZone)
                for (back, page) in [(9, 40), (6, 150), (3, 604), (2, 30), (1, 95), (0, 120)] {
                    _ = try? await app.records.logQuranReading(toPage: page, on: today.adding(days: -back), at: .now.addingTimeInterval(Double(-back) * 86_400))
                }
                _ = try? await app.records.setQuranBookmark(page: 50, on: true, at: .now)
            }
            let page = UserDefaults.standard.integer(forKey: "AzkarQuranPage")
            if page > 0 { request = QuranReaderRequest(page: page) }
            #endif
        }
    }

    private func content(_ mushaf: QuranMushaf) -> some View {
        let records = app.records.records
        let progress = QuranProgress(entries: records.quran)
        let today = DayKey(.now, in: app.settings.settings.timeZone)
        let next = lastPage > 0 ? lastPage : min(progress.position + 1, QuranMushaf.pageCount)
        return List {
            Section {
                QuranProgressCard(mushaf: mushaf, progress: progress, today: today, page: next, hasStarted: !records.quran.isEmpty,
                                  goalPages: RamadanGoal.pagesPerDay(goal: app.settings.settings.app.ramadanKhatmahGoal, today: today,
                                                                     offset: app.settings.settings.app.hijriOffset, quran: records.quran)) {
                    request = QuranReaderRequest(page: next)
                }
            }
            Section {
                Picker(selection: $list) {
                    Text(QL("Surahs")).tag(QuranList.suras)
                    Text(QL("Juz")).tag(QuranList.juz)
                    Text(QL("Bookmarks")).tag(QuranList.bookmarks)
                } label: {
                    Text(QL("Browse"))
                }
                .pickerStyle(.segmented)
                .listRowBackground(Color.clear)
                .listRowInsets(EdgeInsets())
            }
            Section {
                switch list {
                case .suras:
                    ForEach(mushaf.suras) { sura in
                        QuranSuraRow(sura: sura) { request = QuranReaderRequest(page: sura.page) }
                    }
                case .juz:
                    ForEach(mushaf.juz) { juz in
                        QuranJuzRow(juz: juz, sura: mushaf.suras[juz.sura - 1]) { request = QuranReaderRequest(page: juz.page) }
                    }
                case .bookmarks:
                    bookmarks(mushaf, pages: records.quranBookmarks.keys.sorted())
                }
            }
        }
        .listStyle(.insetGrouped)
        .listSectionSpacing(.compact)
    }

    @ViewBuilder private func bookmarks(_ mushaf: QuranMushaf, pages: [Int]) -> some View {
        if pages.isEmpty {
            Text(QL("Pages you bookmark in the mushaf appear here."))
                .foregroundStyle(.secondary)
        }
        ForEach(pages, id: \.self) { page in
            Button {
                request = QuranReaderRequest(page: page)
            } label: {
                HStack {
                    Text(QL("Page \(page)")).foregroundStyle(.primary)
                    Spacer()
                    Text(verbatim: mushaf.sura(ofPage: page).name)
                        .font(.custom(RecitationFont.regular, size: 18, relativeTo: .body))
                        .foregroundStyle(.secondary)
                }
            }
            .buttonStyle(.plain)
            .swipeActions {
                Button(role: .destructive) {
                    setBookmark(page)
                } label: {
                    Label { Text(QL("Remove bookmark")) } icon: { Image(systemName: "bookmark.slash") }
                }
            }
        }
    }

    private func setBookmark(_ page: Int) {
        Task {
            do {
                try await app.records.setQuranBookmark(page: page, on: false, at: .now)
            } catch {
                print("Quran: removing the bookmark failed: \(error)")
            }
        }
    }
}

/// Where the reading stands, and the way back into it.
private struct QuranProgressCard: View {
    @Environment(\.readingLocale) private var format
    let mushaf: QuranMushaf
    let progress: QuranProgress
    let today: DayKey
    let page: Int
    let hasStarted: Bool
    /// Pages a day for the Ramadan goal, while it runs.
    let goalPages: Int?
    let onContinue: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 14) {
                ProgressRing(fraction: Double(progress.position) / Double(QuranMushaf.pageCount), tint: .accentColor) {
                    Image(systemName: "book.pages").font(.system(size: 17, weight: .semibold)).foregroundStyle(Color.accentColor)
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text(QL("Page \(page) of \(QuranMushaf.pageCount)"))
                        .font(.headline)
                    Text(verbatim: "\(mushaf.sura(ofPage: page).name)")
                        .font(.custom(RecitationFont.regular, size: 18, relativeTo: .subheadline))
                        .foregroundStyle(.secondary)
                }
                .monospacedDigit()
            }
            HStack(spacing: 20) {
                figure(QL("Today"), value: Text(QL("\(progress.pages(on: today)) pages")))
                figure(QL("Khatmahs"), value: Text(verbatim: format.number(progress.khatmahs)))
            }
            if let goalPages {
                Text(goalPages == 0 ? SeasonL("Goal reached") : SeasonL("To reach your goal: \(goalPages) pages a day"))
                    .font(.subheadline)
                    .foregroundStyle(.indigo)
            }
            Button(action: onContinue) {
                Text(hasStarted ? QL("Continue reading") : QL("Start reading"))
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
        }
        .padding(.vertical, 4)
    }

    private func figure(_ title: LocalizedStringResource, value: Text) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(title).font(.caption).foregroundStyle(.secondary)
            value.font(.subheadline.weight(.semibold)).monospacedDigit()
        }
        .accessibilityElement(children: .combine)
    }
}

private struct QuranSuraRow: View {
    @Environment(\.readingLocale) private var format
    let sura: QuranSura
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Text(verbatim: format.number(sura.number))
                    .font(.subheadline.weight(.semibold))
                    .monospacedDigit()
                    .foregroundStyle(.secondary)
                    .frame(minWidth: 28)
                VStack(alignment: .leading, spacing: 1) {
                    if format.isArabic {
                        name
                    } else {
                        Text(verbatim: sura.transliteration).foregroundStyle(.primary)
                    }
                    Text(QL("\(sura.ayahCount) ayat"))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer(minLength: 8)
                if !format.isArabic { name }
                Text(verbatim: format.number(sura.page))
                    .font(.subheadline)
                    .monospacedDigit()
                    .foregroundStyle(.secondary)
                    .frame(minWidth: 32, alignment: .trailing)
            }
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
    }

    private var name: some View {
        Text(verbatim: sura.name)
            .font(.custom(RecitationFont.regular, size: 19, relativeTo: .body))
            .foregroundStyle(.primary)
    }
}

private struct QuranJuzRow: View {
    @Environment(\.readingLocale) private var format
    let juz: QuranJuz
    let sura: QuranSura
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Text(QL("Juz \(juz.number)")).foregroundStyle(.primary).monospacedDigit()
                Spacer(minLength: 8)
                Text(verbatim: sura.name)
                    .font(.custom(RecitationFont.regular, size: 18, relativeTo: .body))
                    .foregroundStyle(.secondary)
                Text(verbatim: format.number(juz.page))
                    .font(.subheadline)
                    .monospacedDigit()
                    .foregroundStyle(.secondary)
                    .frame(minWidth: 32, alignment: .trailing)
            }
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
    }
}
