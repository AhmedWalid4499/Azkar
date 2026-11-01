import AzkarKit
import SwiftUI

/// The surahs held by heart, the one reviewed longest ago first, then the rest in mushaf order. A row
/// opens a menu; everything done here goes on the memorisation log, so nothing is ever overwritten.
struct QuranHifzSections: View {
    @Environment(AppEnvironment.self) private var app
    @Environment(\.readingLocale) private var format
    let mushaf: QuranMushaf
    let entries: [HifzEntry]
    let today: DayKey
    let onOpen: (Int) -> Void

    var body: some View {
        let progress = HifzProgress(entries: entries)
        Section {
            ForEach(progress.byLastReview) { held in
                row(mushaf.suras[held.number - 1], held: held)
            }
        } header: {
            Text(QL("\(progress.memorisedCount) of 114 surahs"))
        } footer: {
            if progress.memorisedCount == 0 {
                Text(QL("Mark the surahs you know by heart, and when you review one. This is separate from your place in the khatmah."))
            } else {
                Text(QL("Longest since review first"))
            }
        }
        Section {
            ForEach(mushaf.suras.filter { progress.suras[$0.number] == nil }) { sura in
                row(sura, held: nil)
            }
        } header: {
            Text(QL("Not memorised yet"))
        }
    }

    private func row(_ sura: QuranSura, held: HifzProgress.Sura?) -> some View {
        Menu {
            if held == nil {
                Button { log(.memorised, sura) } label: {
                    Label { Text(QL("Mark as memorised")) } icon: { Image(systemName: "checkmark.circle") }
                }
            } else {
                Button { log(.reviewed, sura) } label: {
                    Label { Text(QL("Reviewed today")) } icon: { Image(systemName: "arrow.clockwise") }
                }
            }
            Button { onOpen(sura.page) } label: {
                Label { Text(QL("Open in the mushaf")) } icon: { Image(systemName: "book.pages") }
            }
            if held != nil {
                Button(role: .destructive) { log(.forgotten, sura) } label: {
                    Label { Text(QL("No longer memorised")) } icon: { Image(systemName: "arrow.uturn.backward") }
                }
            }
        } label: {
            HStack(spacing: 12) {
                Image(systemName: held == nil ? "circle" : "checkmark.circle.fill")
                    .foregroundStyle(held == nil ? AnyShapeStyle(.tertiary) : AnyShapeStyle(.tint))
                VStack(alignment: .leading, spacing: 2) {
                    Text(verbatim: format.isArabic ? sura.name : sura.transliteration)
                        .foregroundStyle(.primary)
                    if let held {
                        Text(line(held))
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                Spacer(minLength: 8)
                if !format.isArabic {
                    Text(verbatim: sura.name)
                        .font(.custom(RecitationFont.regular, size: 18, relativeTo: .body))
                        .foregroundStyle(.secondary)
                }
            }
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
    }

    private func line(_ held: HifzProgress.Sura) -> LocalizedStringResource {
        let shown = held.reviews > 0 ? held.lastReviewedOn : held.memorisedOn
        let date = shown.noonUTC.formatted(Date.FormatStyle(date: .abbreviated, time: .omitted, locale: format.formatting, timeZone: .gmt))
        return held.reviews > 0 ? QL("Last reviewed \(date)") : QL("Memorised \(date)")
    }

    private func log(_ kind: HifzEntry.Kind, _ sura: QuranSura) {
        Task {
            do {
                try await app.records.logHifz(kind, sura: sura.number, on: today)
            } catch {
                print("Quran: logging \(kind) of surah \(sura.number) failed: \(error)")
            }
        }
    }
}
