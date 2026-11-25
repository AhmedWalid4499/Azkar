import AzkarKit
import SwiftUI

/// The version, what happens to the user's data, and where the text and code come from.
struct SettingsAboutView: View {
    @Environment(AppEnvironment.self) private var app
    @Environment(\.locale) private var locale

    var body: some View {
        List {
            Section {
                LabeledContent {
                    Text(version)
                } label: {
                    Text("Version", tableName: SettingsText.table)
                }
            }

            Section {
                Text("Prayer times and the Qibla are calculated on your iPhone. Your records, settings and location are kept only on this iPhone, and are never sent anywhere. To name a place, an approximate position (about a kilometre) is looked up with Apple when you ask, or the city you type is searched in Apple Maps. Azkar has no account, no analytics and no ads.", tableName: SettingsText.table)
                    .font(.callout)
            } header: {
                Text("Privacy", tableName: SettingsText.table)
            }

            Section {
                ForEach(app.dataset.sources, id: \.self) { source in
                    // The dataset describes its sources in English only.
                    CreditRow(name: source.name, detail: source.usedFor, license: source.license, url: URL(string: source.url))
                        .environment(\.layoutDirection, .leftToRight)
                }
            } header: {
                Text("Sources of the azkar", tableName: SettingsText.table)
            } footer: {
                Text("The source details are given as their authors wrote them.", tableName: SettingsText.table)
            }

            Section {
                CreditRow(
                    name: SettingsText.string("Imam an-Nawawi", locale: locale),
                    detail: SettingsText.string("Riyad as-Salihin, compiled by Imam Yahya ibn Sharaf an-Nawawi: the hadith of the day and the hadith library. Only the Arabic text is used, shown as given; the numbering is that of sunnah.com.", locale: locale),
                    license: SettingsText.string("Classical text", locale: locale),
                    url: URL(string: "https://sunnah.com/riyadussalihin")
                )
                CreditRow(
                    name: "CheeseWithSauce/HadithsJSONFormat",
                    detail: SettingsText.string("The digital Arabic text of Riyad as-Salihin, prepared from sunnah.com. Its English translation is not included.", locale: locale),
                    license: "MIT License",
                    url: URL(string: "https://github.com/CheeseWithSauce/HadithsJSONFormat")
                )
            } header: {
                Text("Hadith", tableName: SettingsText.table)
            }

            Section {
                CreditRow(
                    name: "Adhan",
                    detail: SettingsText.string("Prayer time astronomy, by Batoul Apps.", locale: locale),
                    license: "MIT License",
                    url: URL(string: "https://github.com/batoulapps/adhan-swift")
                )
                CreditRow(
                    name: "Amiri",
                    detail: SettingsText.string("The Arabic typeface, by Khaled Hosny.", locale: locale),
                    license: "SIL Open Font License 1.1",
                    url: URL(string: "https://github.com/aliftype/amiri")
                )
                CreditRow(
                    name: "Amiri Quran",
                    detail: SettingsText.string("The typeface of the mushaf, by Khaled Hosny.", locale: locale),
                    license: "SIL Open Font License 1.1",
                    url: URL(string: "https://github.com/aliftype/amiri")
                )
                CreditRow(
                    name: "Tanzil Project",
                    detail: SettingsText.string("The Qur'an text and its page divisions, unchanged. Uthmani text, version 1.1; the search also reads the Simple Clean text, version 1.1, which is not shown.", locale: locale),
                    license: "Creative Commons Attribution 3.0",
                    url: URL(string: "https://tanzil.net")
                )
                CreditRow(
                    name: SettingsText.string("Tafsir Center for Qur'anic Studies", locale: locale),
                    detail: SettingsText.string("The tafsir: al-Mukhtasar fi Tafsir al-Qur'an al-Karim, in Arabic, unchanged, as published on QuranEnc.com (taken 25 November 2026).", locale: locale),
                    license: SettingsText.string("Republished under QuranEnc.com's terms", locale: locale),
                    url: URL(string: "https://quranenc.com/ar/browse/arabic_mokhtasar")
                )
            } header: {
                Text("Software and fonts", tableName: SettingsText.table)
            }

            Section {
                CreditRow(
                    name: "Aaqib Azeez",
                    detail: SettingsText.string("The adhan of the prayer notifications and alarms, published on Wikimedia Commons by Atcovi. Its opening, shortened and re-encoded, shared under the same licence.", locale: locale),
                    license: "Creative Commons Attribution-ShareAlike 4.0",
                    url: URL(string: "https://commons.wikimedia.org/wiki/File:The_Adhan_-_Muslim_Call_to_Prayer_-_Aaqib_Azeez.mp3")
                )
            } header: {
                Text("Sound", tableName: SettingsText.table)
            }
        }
        .navigationTitle(Text("About Azkar", tableName: SettingsText.table))
        .navigationBarTitleDisplayMode(.inline)
    }

    private var version: String {
        let info = Bundle.main.infoDictionary
        let short = info?["CFBundleShortVersionString"] as? String ?? "1.0"
        let build = info?["CFBundleVersion"] as? String ?? "1"
        return "\(short) (\(build))"
    }
}

/// A credit: who, what for, under which licence, and a link.
private struct CreditRow: View {
    let name: String
    let detail: String
    let license: String
    let url: URL?

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(name).font(.headline)
            Text(detail).font(.subheadline)
            Text(license).font(.footnote).foregroundStyle(.secondary)
            if let url {
                Link(url.host() ?? url.absoluteString, destination: url)
                    .font(.footnote)
            }
        }
        .padding(.vertical, 2)
    }
}

#Preview {
    NavigationStack { SettingsAboutView() }
        .environment(try! AppEnvironment())
}
