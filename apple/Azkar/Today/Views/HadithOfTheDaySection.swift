import AzkarKit
import SwiftUI

/// A hadith of Riyad as-Salihin for the day: the same one all day, a short one. Opening it notes
/// that it was read today (shown in the Tracker and the export). The library is loaded at launch
/// (`RootView`); until it is, the section is absent.
struct HadithOfTheDaySection: View {
    @Environment(AppEnvironment.self) private var app
    @Environment(\.locale) private var locale
    let context: TodayContext
    @State private var library = HadithLibrary.shared
    @State private var showing = false

    var body: some View {
        if let hadith = library.collection?.ofTheDay(context.today) {
            let read = app.records.records.hadithRead[context.today] != nil
            Section {
                Button {
                    showing = true
                } label: {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack(spacing: 8) {
                            Image(systemName: "text.book.closed.fill")
                                .foregroundStyle(.teal)
                            Text(H("Hadith of the day"))
                                .font(.headline)
                                .foregroundStyle(.primary)
                            Spacer(minLength: 4)
                            if read {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundStyle(.green)
                                    .accessibilityLabel(Text(H("Read today")))
                            }
                            Image(systemName: "chevron.forward")
                                .font(.footnote.weight(.semibold))
                                .foregroundStyle(.tertiary)
                        }
                        Text(verbatim: hadith.text)
                            .font(.custom(RecitationFont.regular, size: 19, relativeTo: .body))
                            .foregroundStyle(.primary)
                            .lineLimit(4)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .environment(\.layoutDirection, .rightToLeft)
                        Text(H("Riyad as-Salihin \(hadith.number.hadithNumber(locale))"))
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 4)
                    .contentShape(.rect)
                }
                .buttonStyle(.plain)
                .accessibilityElement(children: .combine)
                .sheet(isPresented: $showing) {
                    HadithOfTheDaySheet(hadith: hadith, day: context.today)
                }
                #if DEBUG
                // `-TodayShow hadith` opens it, as a tap would.
                .task {
                    guard TodayDebugLaunch.show == "hadith" else { return }
                    try? await Task.sleep(for: .seconds(1.5))
                    showing = true
                }
                #endif
            }
        }
    }
}

/// The day's hadith in full; opening it is what counts as reading it.
private struct HadithOfTheDaySheet: View {
    let hadith: Hadith
    let day: DayKey
    @Environment(AppEnvironment.self) private var app
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            HadithDetailView(hadith: hadith)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        SheetButton(.close) { dismiss() }
                    }
                }
                .safeAreaInset(edge: .bottom) {
                    Button {
                        dismiss()
                        TodayNavigation.shared.openInLibrary(hadith: hadith.number)
                    } label: {
                        Label { Text(H("Open in library")) } icon: { Image(systemName: "books.vertical") }
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.large)
                    .padding()
                }
        }
        .appDirection()
        .task { try? await app.records.logHadithRead(hadith.number, on: day) }
    }
}
