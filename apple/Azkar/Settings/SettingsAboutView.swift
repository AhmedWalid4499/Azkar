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
                    detail: SettingsText.string("The Qur'an text and its page divisions, unchanged. Uthmani text, version 1.1.", locale: locale),
                    license: "Creative Commons Attribution 3.0",
                    url: URL(string: "https://tanzil.net")
                )
            } header: {
                Text("Software and fonts", tableName: SettingsText.table)
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
