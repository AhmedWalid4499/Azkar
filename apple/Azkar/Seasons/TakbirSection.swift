import AzkarKit
import SwiftUI

/// On the takbir days (the night and morning of Eid al-Fitr, and 1 to 13 Dhu al-Hijjah) a card on
/// Today that opens a takbir counter. Every takbir is kept with the tasbih counter's records.
struct TakbirSection: View {
    @Environment(AppEnvironment.self) private var app
    @Environment(\.todayFormat) private var format
    let context: TodayContext
    @State private var showsCounter = false

    var body: some View {
        let afterMaghrib = context.todayTimes?[prayer: .maghrib].map { $0 <= context.now } ?? false
        if let season = TakbirDays.season(on: context.today, afterMaghrib: afterMaghrib, offset: app.settings.settings.app.hijriOffset) {
            let day = TasbihStats.openDay(today: context.today, beforeDawn: context.beforeDawn)
            let today = app.records.records.day(day).tasbih[TasbihRecord.takbir]?.count ?? 0
            Section {
                Button {
                    showsCounter = true
                } label: {
                    HStack(spacing: 12) {
                        Image(systemName: "speaker.wave.2.fill")
                            .font(.title2)
                            .foregroundStyle(.orange)
                            .frame(width: 32)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(SeasonL("Say the takbir"))
                                .font(.headline)
                                .foregroundStyle(.primary)
                            Text(today > 0 ? SeasonL("\(format.number(today)) said today") : detail(season))
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                                .monospacedDigit()
                        }
                        Spacer(minLength: 4)
                        Image(systemName: "chevron.forward")
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(.tertiary)
                    }
                    .padding(.vertical, 2)
                    .contentShape(.rect)
                }
                .buttonStyle(.plain)
                .accessibilityElement(children: .combine)
            }
            .sheet(isPresented: $showsCounter) {
                TakbirCounterSheet(season: season, day: day)
            }
            #if DEBUG
            // `-TodayShow takbir` opens the counter at launch, for screenshots.
            .task { if UserDefaults.standard.string(forKey: "TodayShow") == "takbir" { showsCounter = true } }
            #endif
        }
    }

    private func detail(_ season: TakbirSeason) -> LocalizedStringResource {
        switch season {
        case .eidAlFitr: SeasonL("From the night of Eid until the Eid prayer")
        case let .dhulHijjah(day) where day <= 10: SeasonL("The ten days of Dhul Hijjah: day \(format.number(day))")
        case .dhulHijjah: SeasonL("The days of Tashriq")
        }
    }
}

/// The takbir counter: a tap for each takbir, with today's count and every takbir ever.
struct TakbirCounterSheet: View {
    let season: TakbirSeason
    let day: DayKey
    @Environment(AppEnvironment.self) private var app
    @Environment(\.todayFormat) private var format
    @Environment(\.dismiss) private var dismiss
    @State private var counter: KeyedCounter?

    var body: some View {
        let key = TasbihRecord.takbir
        let takbir = app.dataset.dhikr(id: "allahu-akbar")
        NavigationStack {
            VStack(spacing: 20) {
                if let takbir {
                    RecitationView(text: takbir.arabic, scale: app.settings.settings.reader.arabicScale, alignment: .center)
                    let reader = app.settings.settings.reader
                    if ReaderSettings.resolve(reader.showTransliteration, languageCode: format.isArabic ? "ar" : "en"), let transliteration = takbir.transliteration {
                        Text(verbatim: transliteration)
                            .font(.body.italic())
                            .foregroundStyle(.secondary)
                    }
                }
                Spacer(minLength: 0)
                if let counter {
                    TasbihDial(current: counter.current(key, on: day), target: nil) {
                        counter.add(key, on: day)
                    }
                    .frame(maxWidth: 320)
                    HStack(spacing: 24) {
                        VStack(spacing: 2) {
                            Text(verbatim: format.number(counter.count(key, on: day)))
                                .font(.title3.weight(.semibold))
                                .monospacedDigit()
                            Text(SeasonL("Today")).font(.caption).foregroundStyle(.secondary)
                        }
                        VStack(spacing: 2) {
                            Text(verbatim: format.number(counter.lifetime(key)))
                                .font(.title3.weight(.semibold))
                                .monospacedDigit()
                            Text(SeasonL("In all")).font(.caption).foregroundStyle(.secondary)
                        }
                    }
                    .accessibilityElement(children: .combine)
                }
                Spacer(minLength: 0)
            }
            .padding(24)
            .frame(maxWidth: .infinity)
            .navigationTitle(Text(SeasonL("Takbir")))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button { dismiss() } label: { Text(SeasonL("Done")) }
                }
                ToolbarItem(placement: .bottomBar) {
                    Button {
                        counter?.undo(key, on: day)
                    } label: {
                        Label { Text(SeasonL("Undo")) } icon: { Image(systemName: "arrow.uturn.backward") }
                    }
                    .disabled((counter?.current(key, on: day) ?? 0) == 0)
                }
            }
            .sensoryFeedback(.impact(weight: .light), trigger: counter?.ticks ?? 0) { _, _ in app.settings.settings.reader.haptics }
        }
        .presentationDetents([.large])
        .onAppear { if counter == nil { counter = KeyedCounter(records: app.records) } }
    }
}
