import AzkarKit
import SwiftUI

/// The Settings tab: a native form of everything the user can choose, their data and the credits.
struct SettingsScreen: View {
    @Environment(AppEnvironment.self) private var app
    @State private var path: [SettingsPage] = []

    var body: some View {
        NavigationStack(path: $path) {
            ScrollViewReader { scroller in
                Form {
                    SettingsNameSection()
                    SettingsLocationSection()
                    Section {
                        NavigationLink(value: SettingsPage.calculation) {
                            Label { Text("Prayer times", tableName: SettingsText.table) } icon: { Image(systemName: "clock") }
                        }
                        NavigationLink(value: SettingsPage.reminders) {
                            Label { Text("Reminders", tableName: SettingsText.table) } icon: { Image(systemName: "bell.badge") }
                        }
                        NavigationLink(value: SettingsPage.reader) {
                            Label { Text("Azkar reader", tableName: SettingsText.table) } icon: { Image(systemName: "book") }
                        }
                    }
                    SettingsGeneralSection()
                        .id("general")
                    SettingsDataSection()
                        .id("data")
                    Section {
                        NavigationLink(value: SettingsPage.about) {
                            Label { Text("About Azkar", tableName: SettingsText.table) } icon: { Image(systemName: "info.circle") }
                        }
                    }
                    .id("about")
                }
                #if DEBUG
                .task {
                    if let target = SettingsDemo.scrollTarget {
                        try? await Task.sleep(for: .milliseconds(600))
                        scroller.scrollTo(target, anchor: .top)
                    }
                }
                #endif
            }
            .navigationTitle(Text("Settings", tableName: SettingsText.table))
            .navigationDestination(for: SettingsPage.self) { page in
                switch page {
                case .calculation: SettingsCalculationView()
                case .adjustments: SettingsAdjustmentsView()
                case .reminders: SettingsRemindersView()
                case .reader: SettingsReaderView()
                case .imported: SettingsImportHistoryView()
                case .about: SettingsAboutView()
                }
            }
        }
        .settingsChosenDigits()
        #if DEBUG
        .task {
            SettingsDemo.applyOnce(to: app)
            if let page = SettingsDemo.openPage() { path = page }
        }
        #endif
    }
}

/// The pages Settings opens.
enum SettingsPage: Hashable {
    case calculation, adjustments, reminders, reader, imported, about
}

#Preview {
    SettingsScreen()
        .environment(try! AppEnvironment())
}
