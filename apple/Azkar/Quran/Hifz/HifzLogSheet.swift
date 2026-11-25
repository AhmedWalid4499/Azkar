import AzkarKit
import SwiftUI

/// What the memorise sheet opens with.
struct HifzLogRequest: Identifiable {
    let id = UUID()
    var kind: HifzEntry.Kind = .memorised
    var sura = 1
    /// `nil` for the whole surah.
    var ayat: ClosedRange<Int>?
    /// A page of the mushaf, whose ayat are logged together (they can run across two surahs).
    var page: Int?

    static func page(_ page: Int) -> HifzLogRequest { HifzLogRequest(page: page) }
}

/// Logs ayat memorised or reviewed: a whole surah, a stretch of it, or a page of the mushaf, on
/// today or a day before. Every save adds lines to the log; nothing is overwritten.
struct HifzLogSheet: View {
    @Environment(AppEnvironment.self) private var app
    @Environment(\.dismiss) private var dismiss
    @Environment(\.readingLocale) private var format
    let mushaf: QuranMushaf
    @State private var kind: HifzEntry.Kind
    @State private var sura: Int
    @State private var whole: Bool
    @State private var from: Int
    @State private var to: Int
    @State private var page: Int?
    @State private var strength = HifzStrength.good
    @State private var date = Date.now

    init(mushaf: QuranMushaf, request: HifzLogRequest) {
        self.mushaf = mushaf
        _kind = State(initialValue: request.kind)
        _sura = State(initialValue: request.sura)
        _whole = State(initialValue: request.ayat == nil)
        _from = State(initialValue: request.ayat?.lowerBound ?? 1)
        _to = State(initialValue: request.ayat?.upperBound ?? mushaf.suras[request.sura - 1].ayahCount)
        _page = State(initialValue: request.page)
    }

    private var ayahCount: Int { mushaf.suras[sura - 1].ayahCount }

    /// What a save logs; empty while the ayat typed are not a range of the surah.
    private var spans: [AyahSpan] {
        if let page { return mushaf.spans(onPage: page) }
        if whole { return [AyahSpan(sura: sura, from: 1, to: ayahCount)] }
        guard 1 <= from, from <= to, to <= ayahCount else { return [] }
        return [AyahSpan(sura: sura, from: from, to: to)]
    }

    var body: some View {
        let timeZone = app.settings.settings.timeZone
        NavigationStack {
            Form {
                Section {
                    Picker(selection: $kind) {
                        Text(QL("Memorised")).tag(HifzEntry.Kind.memorised)
                        Text(QL("Reviewed")).tag(HifzEntry.Kind.reviewed)
                    } label: {
                        Text(QL("What"))
                    }
                    .pickerStyle(.segmented)
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets())
                }
                if let page {
                    Section {
                        ForEach(mushaf.spans(onPage: page)) { span in
                            Text(verbatim: format.span(span, in: mushaf))
                        }
                        Button {
                            let first = mushaf.spans(onPage: page)[0]
                            sura = first.sura
                            from = first.from
                            to = first.to
                            whole = first.isWholeSura
                            self.page = nil
                        } label: {
                            Text(QL("Choose the ayat instead"))
                        }
                    } header: {
                        Text(QL("Page \(page)"))
                    }
                } else {
                    Section {
                        HifzSuraPicker(title: QL("Surah"), mushaf: mushaf, sura: $sura)
                        Toggle(isOn: $whole) { Text(QL("The whole surah")) }
                        if !whole {
                            HifzNumberField(title: QL("From ayah"), value: $from, range: 1...ayahCount)
                            HifzNumberField(title: QL("To ayah"), value: $to, range: 1...ayahCount)
                        }
                    } footer: {
                        if spans.isEmpty {
                            Text(QL("Ayat 1 to \(ayahCount)")).foregroundStyle(.red)
                        } else {
                            Text(QL("\(spans.reduce(0) { $0 + $1.count }) ayat"))
                        }
                    }
                }
                if kind == .reviewed {
                    Section {
                        Picker(selection: $strength) {
                            ForEach(HifzStrength.allCases, id: \.self) { strength in
                                Text(strength.title).tag(strength)
                            }
                        } label: {
                            Text(QL("How did it go?"))
                        }
                        .pickerStyle(.segmented)
                    } header: {
                        Text(QL("How did it go?"))
                    } footer: {
                        Text(strength.detail)
                    }
                }
                Section {
                    DatePicker(selection: $date, in: ...Date.now, displayedComponents: .date) {
                        Text(QL("Day"))
                    }
                }
            }
            .navigationTitle(Text(kind == .memorised ? QL("Log memorisation") : QL("Log a review")))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    SheetButton(.close) { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    SheetButton(.confirm) {
                        save(timeZone: timeZone)
                    } label: {
                        Text(QL("Save"))
                    }
                    .disabled(spans.isEmpty)
                }
            }
            // Another surah starts from its whole range.
            .onChange(of: sura) { _, _ in
                from = 1
                to = ayahCount
            }
        }
        .sensoryFeedback(.selection, trigger: kind)
    }

    private func save(timeZone: TimeZone) {
        let today = DayKey(.now, in: timeZone)
        let day = min(DayKey(date, in: timeZone), today)
        let spans = spans
        let kind = kind
        let strength = kind == .reviewed ? strength : nil
        Task {
            do {
                try await app.records.logHifz(kind, spans: spans, strength: strength, on: day,
                                              at: HifzLog.instant(for: day, today: today, timeZone: timeZone))
            } catch {
                print("Quran: logging memorisation failed: \(error)")
            }
        }
        dismiss()
    }
}
