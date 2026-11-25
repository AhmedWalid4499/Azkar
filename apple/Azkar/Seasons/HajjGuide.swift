import AzkarKit
import SwiftUI

/// One step of the Umrah or of the days of Hajj: what it is, the duas Hisn al-Muslim gives for
/// it (chapters of the duas for occasions), and a lap counter where laps are counted.
struct HajjStep: Identifiable {
    let id: String
    let title: LocalizedStringResource
    let detail: LocalizedStringResource
    let symbol: String
    var chapters: [Int] = []
    var lap: HajjLap?

    static let umrah: [HajjStep] = [
        HajjStep(id: "ihram", title: SeasonL("Ihram and the talbiyah"),
                 detail: SeasonL("Make the intention at the miqat and repeat the talbiyah until you reach the Ka'bah."),
                 symbol: "person.fill.checkmark", chapters: [116]),
        HajjStep(id: "tawaf", title: SeasonL("Tawaf"),
                 detail: SeasonL("Seven laps round the Ka'bah, starting at the Black Stone. Say the takbir each time you pass it."),
                 symbol: "arrow.trianglehead.counterclockwise", chapters: [117, 118], lap: .tawaf),
        HajjStep(id: "rakahs", title: SeasonL("Two rakahs"),
                 detail: SeasonL("Pray two rakahs behind the Station of Ibrahim, or anywhere in the mosque, then drink Zamzam."),
                 symbol: "figure.mind.and.body"),
        HajjStep(id: "sai", title: SeasonL("Sa'i"),
                 detail: SeasonL("Seven laps between as-Safa and al-Marwah, starting at as-Safa and ending at al-Marwah."),
                 symbol: "arrow.left.and.right", chapters: [119], lap: .sai),
        HajjStep(id: "hair", title: SeasonL("Shaving or shortening the hair"),
                 detail: SeasonL("Men shave the head or shorten the hair; women shorten it by a fingertip's length. The Umrah is complete."),
                 symbol: "scissors"),
    ]

    static let hajjDays: [HajjStep] = [
        HajjStep(id: "day8", title: SeasonL("8 Dhul Hijjah: the day of Tarwiyah"),
                 detail: SeasonL("Enter ihram, go to Mina and pray there, each prayer in its time, shortening the four-rakah prayers."),
                 symbol: "tent.fill", chapters: [116]),
        HajjStep(id: "day9", title: SeasonL("9 Dhul Hijjah: Arafah"),
                 detail: SeasonL("Stand at Arafah from after noon until sunset in dua and remembrance, then go to Muzdalifah."),
                 symbol: "sun.max.fill", chapters: [120]),
        HajjStep(id: "muzdalifah", title: SeasonL("The night at Muzdalifah"),
                 detail: SeasonL("Pray Maghrib and Isha together, spend the night, and after Fajr remember Allah at al-Mash'ar al-Haram."),
                 symbol: "moon.stars.fill", chapters: [121]),
        HajjStep(id: "day10", title: SeasonL("10 Dhul Hijjah: the day of sacrifice"),
                 detail: SeasonL("Stone Jamrat al-Aqabah with seven pebbles, offer the sacrifice, shave or shorten the hair, and make tawaf al-ifadah and the sa'i."),
                 symbol: "flame.fill", chapters: [122, 128]),
        HajjStep(id: "tashriq", title: SeasonL("11 to 13 Dhul Hijjah: the days of Tashriq"),
                 detail: SeasonL("Stay at Mina and each day after noon stone the three jamarat, seven pebbles each, making dua after the first two."),
                 symbol: "circle.grid.3x3.fill", chapters: [122]),
        HajjStep(id: "farewell", title: SeasonL("The farewell tawaf"),
                 detail: SeasonL("The last thing before leaving Makkah: seven laps round the Ka'bah."),
                 symbol: "hand.wave.fill", lap: .tawaf),
    ]
}

/// The card on Today while Hajj and Umrah mode is on.
struct HajjSection: View {
    @Environment(AppEnvironment.self) private var app
    @Environment(\.todayFormat) private var format
    let context: TodayContext
    @State private var showsGuide = false

    var body: some View {
        if app.settings.settings.app.hajjMode {
            let day = TasbihStats.openDay(today: context.today, beforeDawn: context.beforeDawn)
            let records = app.records.records.day(day)
            let laps = HajjLap.allCases.reduce(0) { $0 + (records.tasbih[$1.rawValue]?.count ?? 0) }
            Section {
                Button {
                    showsGuide = true
                } label: {
                    HStack(spacing: 12) {
                        Image(systemName: "building.columns.fill")
                            .font(.title2)
                            .foregroundStyle(.brown)
                            .frame(width: 32)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(SeasonL("Hajj and Umrah"))
                                .font(.headline)
                                .foregroundStyle(.primary)
                            Text(laps > 0 ? SeasonL("\(format.number(laps)) laps counted today") : SeasonL("The steps, their duas and a lap counter"))
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
            .sheet(isPresented: $showsGuide) {
                HajjGuideView(day: day)
            }
            #if DEBUG
            // `-TodayShow hajj` opens the guide at launch, for screenshots.
            .task { if UserDefaults.standard.string(forKey: "TodayShow") == "hajj" { showsGuide = true } }
            #endif
        }
    }
}

/// The guide: the Umrah step by step, then the days of Hajj, each with its duas and laps, and
/// a way to log an Umrah or the Hajj as done.
struct HajjGuideView: View {
    let day: DayKey
    @Environment(AppEnvironment.self) private var app
    @Environment(\.dismiss) private var dismiss
    @Environment(\.locale) private var locale
    @State private var reading: ReadingContext?
    @State private var counter: KeyedCounter?

    var body: some View {
        NavigationStack {
            if let reading, let counter {
                let settings = app.settings.settings
                List {
                    Section {
                        ForEach(HajjStep.umrah) { step in
                            HajjStepRow(step: step, day: day, counter: counter)
                        }
                        doneToggle(.umrah, SeasonL("I completed an Umrah today"))
                    } header: {
                        Text(SeasonL("Umrah"))
                    }
                    Section {
                        ForEach(HajjStep.hajjDays) { step in
                            HajjStepRow(step: step, day: day, counter: counter)
                        }
                        doneToggle(.hajj, SeasonL("I completed the Hajj"))
                    } header: {
                        Text(SeasonL("The days of Hajj"))
                    } footer: {
                        Text(SeasonL("A short reminder of the steps, not a ruling: follow the scholars you trust for the details of your Hajj."))
                    }
                }
                .navigationTitle(Text(SeasonL("Hajj and Umrah")))
                .navigationBarTitleDisplayMode(.inline)
                .navigationDestination(for: ReadingDestination.self) { destination in
                    if case let .occasion(number) = destination, let chapter = OccasionsBook.bundled.chapter(number) {
                        OccasionChapterView(chapter: chapter)
                    }
                }
                .navigationDestination(for: HajjLap.self) { lap in
                    HajjLapCounterView(lap: lap, day: day, counter: counter)
                }
                .toolbar {
                    ToolbarItem(placement: .confirmationAction) {
                        Button { dismiss() } label: { Text(SeasonL("Done")) }
                    }
                }
                .environment(reading)
                .environment(\.readingLocale, ReadingLocale(locale: locale, app: settings.app, timeZone: settings.timeZone))
                .sensoryFeedback(.impact(weight: .light), trigger: counter.ticks) { _, _ in settings.reader.haptics }
            }
        }
        .onAppear {
            if reading == nil { reading = ReadingContext(app) }
            if counter == nil { counter = KeyedCounter(records: app.records) }
        }
    }

    private func doneToggle(_ deed: SeasonDeed, _ title: LocalizedStringResource) -> some View {
        let done = app.records.records.seasons[day]?[deed] != nil
        return Toggle(isOn: Binding(
            get: { done },
            set: { $0 ? app.saveSeason(deed, on: day) : app.clearSeason(deed, on: day) }
        )) {
            Text(title)
        }
        .sensoryFeedback(.success, trigger: done) { _, new in new }
    }
}

private struct HajjStepRow: View {
    let step: HajjStep
    let day: DayKey
    let counter: KeyedCounter
    @Environment(\.readingLocale) private var locale

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label {
                VStack(alignment: .leading, spacing: 4) {
                    Text(step.title).font(.headline)
                    Text(step.detail).font(.subheadline).foregroundStyle(.secondary)
                }
            } icon: {
                Image(systemName: step.symbol).foregroundStyle(.brown)
            }
            if let lap = step.lap {
                NavigationLink(value: lap) {
                    Label {
                        Text(SeasonL("Count the laps: \(locale.number(counter.current(lap.rawValue, on: day))) of \(locale.number(HajjLap.laps))"))
                            .monospacedDigit()
                    } icon: {
                        Image(systemName: "number.circle")
                    }
                    .font(.subheadline.weight(.medium))
                }
            }
            ForEach(step.chapters, id: \.self) { number in
                if let chapter = OccasionsBook.bundled.chapter(number) {
                    NavigationLink(value: ReadingDestination.occasion(number)) {
                        Label {
                            Text(verbatim: locale.isArabic ? chapter.title.ar : chapter.title.en)
                        } icon: {
                            Image(systemName: "hands.and.sparkles")
                        }
                        .font(.subheadline.weight(.medium))
                    }
                }
            }
        }
        .padding(.vertical, 4)
    }
}

/// Seven laps of tawaf or sa'i: a tap for each, a success haptic at the seventh, and a new round.
struct HajjLapCounterView: View {
    let lap: HajjLap
    let day: DayKey
    let counter: KeyedCounter
    @Environment(\.readingLocale) private var locale
    @Environment(AppEnvironment.self) private var app

    var body: some View {
        let current = counter.current(lap.rawValue, on: day)
        let complete = current >= HajjLap.laps
        VStack(spacing: 24) {
            Text(lap == .tawaf ? SeasonL("Each lap round the Ka'bah, from the Black Stone back to it") : SeasonL("Each way between as-Safa and al-Marwah is one lap"))
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            TasbihDial(current: min(current, HajjLap.laps), target: HajjLap.laps) {
                guard !complete else { return }
                counter.add(lap.rawValue, on: day)
            }
            .frame(maxWidth: 320)
            Text(complete ? SeasonL("All seven laps are done") : SeasonL("Lap \(locale.number(current + 1)) of \(locale.number(HajjLap.laps))"))
                .font(.title3.weight(.semibold))
                .monospacedDigit()
                .contentTransition(.numericText(value: Double(current)))
            HStack(spacing: 16) {
                Button {
                    counter.undo(lap.rawValue, on: day)
                } label: {
                    Label { Text(SeasonL("Undo")) } icon: { Image(systemName: "arrow.uturn.backward") }
                }
                .disabled(current == 0)
                Button {
                    counter.reset(lap.rawValue, on: day)
                } label: {
                    Label { Text(SeasonL("Start again")) } icon: { Image(systemName: "arrow.counterclockwise") }
                }
                .disabled(current == 0)
            }
            .buttonStyle(.bordered)
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .navigationTitle(Text(lap == .tawaf ? SeasonL("Tawaf") : SeasonL("Sa'i")))
        .navigationBarTitleDisplayMode(.inline)
        .animation(.snappy, value: current)
        .sensoryFeedback(.success, trigger: complete) { _, new in new && app.settings.settings.reader.haptics }
    }
}
