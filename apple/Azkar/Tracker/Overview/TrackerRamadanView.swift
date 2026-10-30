import AzkarKit
import SwiftUI

/// Ramadan and the Eids year by year: the khatmah goal, then what each year holds.
struct TrackerRamadanSections: View {
    let data: TrackerData
    @Environment(AppEnvironment.self) private var app
    @Environment(\.trackerFormat) private var format

    var body: some View {
        let offset = data.settings.app.hijriOffset
        let current = HijriCalendar.date(of: data.today, offset: offset).year
        TrackerRamadanGoalSection(data: data)
        ForEach(data.history.ramadanYears(current: current, offset: offset), id: \.self) { year in
            yearSection(RamadanSummary(hijriYear: year, offset: offset, history: data.history), isCurrent: year == current, offset: offset)
        }
    }

    private func yearSection(_ summary: RamadanSummary, isCurrent: Bool, offset: Int) -> some View {
        let dates = IslamicOccasions.dates(hijriYear: summary.year, offset: offset)
        let nights = RamadanCalendar.nights(hijriYear: summary.year, offset: offset)
        return Section {
            row(SeasonL("Fasts kept"), "moon.haze.fill", value: SeasonL("\(summary.fasted) of \(summary.days)"))
            LabeledContent {
                Text(SeasonL("\(summary.tarawih) nights")).monospacedDigit()
            } label: {
                Label {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(SeasonL("Tarawih"))
                        if summary.tarawih > 0 {
                            Text(detail(summary)).font(.caption).foregroundStyle(.secondary)
                        }
                    }
                } icon: {
                    Image(systemName: "moon.stars.fill").foregroundStyle(.indigo)
                }
            }
            .accessibilityElement(children: .combine)
            row(SeasonL("Nights of the last ten"), "sparkles", value: SeasonL("\(summary.lastTenStood) of \(summary.lastTenNights)"))
            row(SeasonL("Quran pages"), "book.pages.fill", value: summary.pagesRead)
            row(SeasonL("Khatmahs"), "checkmark.seal.fill", value: summary.khatmahs)
            if let eid = dates.first(where: { $0.occasion == .eidAlFitr }) {
                eidRow(eid, prayed: summary.eidFitrPrayed)
            }
            if let eid = dates.first(where: { $0.occasion == .eidAlAdha }) {
                eidRow(eid, prayed: summary.eidAdhaPrayed)
            }
            if isCurrent, let first = nights.first, first.evening <= data.today {
                NavigationLink(value: TrackerRoute.ramadanNights(summary.year)) {
                    Text(SeasonL("Every night"))
                }
            }
        } header: {
            Text(verbatim: HijriFormat.monthAndYear(HijriDate(year: summary.year, month: HijriDate.ramadan, day: 1), locale: format.display))
        }
    }

    private func detail(_ summary: RamadanSummary) -> LocalizedStringResource {
        summary.tarawihRakahs > 0
            ? SeasonL("Masjid \(summary.tarawihAtMasjid), home \(summary.tarawihAtHome), \(summary.tarawihRakahs) rakahs")
            : SeasonL("Masjid \(summary.tarawihAtMasjid), home \(summary.tarawihAtHome)")
    }

    private func row(_ title: LocalizedStringResource, _ symbol: String, value: Int) -> some View {
        row(title, symbol) { Text(verbatim: format.number(value)) }
    }

    private func row(_ title: LocalizedStringResource, _ symbol: String, value: LocalizedStringResource) -> some View {
        row(title, symbol) { Text(value) }
    }

    private func row(_ title: LocalizedStringResource, _ symbol: String, @ViewBuilder value: () -> Text) -> some View {
        LabeledContent {
            value().monospacedDigit()
        } label: {
            Label { Text(title) } icon: { Image(systemName: symbol).foregroundStyle(.indigo) }
        }
        .accessibilityElement(children: .combine)
    }

    /// An Eid's prayer can be ticked from its day on.
    private func eidRow(_ eid: OccasionDates, prayed: Bool) -> some View {
        Toggle(isOn: Binding(
            get: { prayed },
            set: { $0 ? app.saveSeason(.eidPrayer, on: eid.first) : app.clearSeason(.eidPrayer, on: eid.first) }
        )) {
            Label {
                VStack(alignment: .leading, spacing: 2) {
                    Text(eid.occasion.title)
                    Text(verbatim: format.fullDay(eid.first)).font(.caption).foregroundStyle(.secondary)
                }
            } icon: {
                Image(systemName: eid.occasion.symbol).foregroundStyle(eid.occasion.tint)
            }
        }
        .disabled(eid.first > data.today)
    }
}

/// How many khatmahs to aim for in Ramadan, and what that takes each day while it runs.
private struct TrackerRamadanGoalSection: View {
    let data: TrackerData
    @Environment(AppEnvironment.self) private var app

    var body: some View {
        let goal = data.settings.app.ramadanKhatmahGoal
        Section {
            Picker(selection: Binding(get: { goal }, set: { value in app.settings.update { $0.app.ramadanKhatmahGoal = value } })) {
                Text(SeasonL("No goal")).tag(0)
                ForEach(1...5, id: \.self) { count in
                    Text(verbatim: count.formatted()).tag(count)
                }
            } label: {
                Label { Text(SeasonL("Khatmahs this Ramadan")) } icon: { Image(systemName: "target").foregroundStyle(.indigo) }
            }
            .pickerStyle(.menu)
        } footer: {
            if let pages = RamadanGoal.pagesPerDay(goal: goal, today: data.today, offset: data.settings.app.hijriOffset, quran: data.records.quran) {
                Text(pages == 0 ? SeasonL("Goal reached") : SeasonL("To reach your goal: \(pages) pages a day"))
            } else if goal > 0 {
                Text(SeasonL("Once Ramadan starts, this shows the pages to read each day."))
            }
        }
    }
}

/// Every night of a Ramadan so far. Each opens its day, where its tarawih can be logged or changed.
struct TrackerRamadanNightsView: View {
    let data: TrackerData
    let year: Int
    @Environment(\.trackerFormat) private var format

    var body: some View {
        let nights = RamadanCalendar.nights(hijriYear: year, offset: data.settings.app.hijriOffset).filter { $0.evening <= data.today }
        List {
            ForEach(nights.reversed()) { night in
                NavigationLink(value: TrackerRoute.day(night.evening)) {
                    LabeledContent {
                        Text(status(night))
                    } label: {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(SeasonL("Night \(night.number)")).monospacedDigit()
                            Text(verbatim: format.fullDay(night.evening)).font(.caption).foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
        .navigationTitle(Text(SeasonL("Every night")))
        .navigationBarTitleDisplayMode(.inline)
    }

    private func status(_ night: RamadanNight) -> LocalizedStringResource {
        guard let record = data.records.seasons[night.evening]?[.tarawih] else { return SeasonL("Not logged") }
        return record.place?.title ?? SeasonL("Logged")
    }
}

/// A day's deeds of the season: the tarawih of the night that falls on it, or its Eid prayer.
struct TrackerDaySeasonSection: View {
    let data: TrackerData
    let day: DayKey
    @Environment(AppEnvironment.self) private var app

    var body: some View {
        let offset = data.settings.app.hijriOffset
        let seasons = data.records.seasons[day] ?? [:]
        let eid = FastingCalendar.forbiddenDay(HijriCalendar.date(of: day, offset: offset))
        if let night = RamadanCalendar.night(onEvening: day, offset: offset) {
            Section {
                TarawihControl(record: seasons[.tarawih], evening: day)
                    .padding(.vertical, 4)
            } header: {
                Text(SeasonL("Tarawih, night \(night.number)"))
            }
        }
        if eid == .eidAlFitr || eid == .eidAlAdha {
            Section {
                Toggle(isOn: Binding(
                    get: { seasons[.eidPrayer] != nil },
                    set: { $0 ? app.saveSeason(.eidPrayer, on: day) : app.clearSeason(.eidPrayer, on: day) }
                )) {
                    Text(SeasonL("I prayed the Eid prayer"))
                }
            }
        }
    }
}
