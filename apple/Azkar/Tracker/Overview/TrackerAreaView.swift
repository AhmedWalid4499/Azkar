import AzkarKit
import SwiftUI

/// The way into each area from the main page, with where it stands right now.
struct TrackerAreasSection: View {
    let data: TrackerData
    @Environment(\.trackerFormat) private var format

    var body: some View {
        Section {
            ForEach(Self.areas, id: \.self) { area in
                NavigationLink(value: TrackerRoute.area(area)) {
                    Label {
                        VStack(alignment: .leading, spacing: 2) {
                            format.text(area.title)
                            summary(area)
                                .font(.subheadline.monospacedDigit())
                                .foregroundStyle(.secondary)
                        }
                    } icon: {
                        Image(systemName: area.symbol).foregroundStyle(area.tint)
                    }
                }
            }
            NavigationLink(value: TrackerRoute.yearReview) {
                TrackerYearRow(data: data)
            }
        }
    }

    private static let areas: [TrackerArea] = [.prayers, .azkar, .quran, .fasting, .ramadan]

    private func summary(_ area: TrackerArea) -> Text {
        let history = data.history
        switch area {
        case .prayers:
            let missed = PrayerStats.outstandingMissed(history.prayers, today: data.today).count
            let rate = PrayerStats.completionRate(history.prayers, today: data.clock.statsDay, days: 7)
            if missed > 0 { return Text("\(missed) missed prayers to make up", tableName: "Tracker") }
            return Text("\(rate.done) of \(rate.due) prayed this week", tableName: "Tracker")
        case .azkar:
            let streak = AzkarStats.streaks(history.sessions, today: data.today, beforeDawn: data.clock.beforeDawn)
            return Text("Streaks: morning \(streak.morning.current), evening \(streak.evening.current)", tableName: "Tracker")
        case .quran:
            if data.records.quran.isEmpty { return Text("Not started yet", tableName: "Tracker") }
            return Text("Page \(data.quran.position), khatmahs: \(data.quran.khatmahs)", tableName: "Tracker")
        case .fasting:
            let owed = data.fasting.owed.remaining
            if owed > 0 { return Text("\(owed) days to make up", tableName: "Tracker") }
            return Text("\(data.fasting.voluntary.month) voluntary this month", tableName: "Tracker")
        case .ramadan:
            let offset = data.settings.app.hijriOffset
            let year = HijriCalendar.date(of: data.today, offset: offset).year
            let summary = RamadanSummary(hijriYear: year, offset: offset, history: history)
            if !summary.hasAnyRecord, let first = RamadanCalendar.nights(hijriYear: year, offset: offset).first, first.evening > data.today {
                return Text(seasonCountdown(from: data.today, to: first.evening.adding(days: 1)))
            }
            return Text(SeasonL("\(summary.fasted) fasts, \(summary.tarawih) tarawih, \(summary.khatmahs) khatmahs"))
        }
    }
}

/// One area in full: what stands out first, then its recent days, streaks, weeks and totals.
struct TrackerAreaView: View {
    let data: TrackerData
    let area: TrackerArea
    @Environment(\.trackerFormat) private var format

    var body: some View {
        List {
            switch area {
            case .prayers:
                TrackerMissedSummarySection(data: data)
                TrackerRecentSection(data: data, area: area)
                TrackerStreaksSection(data: data, area: area)
                TrackerTrendSections(data: data, area: area)
                TrackerLifetimeSection(data: data, area: area)
            case .azkar:
                TrackerRecentSection(data: data, area: area)
                TrackerStreaksSection(data: data, area: area)
                TrackerTrendSections(data: data, area: area)
                TrackerLifetimeSection(data: data, area: area)
            case .quran:
                TrackerQuranSection(data: data)
                TrackerQuranGoalSection(data: data)
                TrackerRecentSection(data: data, area: area)
                TrackerTrendSections(data: data, area: area)
                TrackerLifetimeSection(data: data, area: area)
            case .fasting:
                TrackerFastingSection(data: data)
                TrackerRecentSection(data: data, area: area)
                TrackerTrendSections(data: data, area: area)
                TrackerLifetimeSection(data: data, area: area)
            case .ramadan:
                TrackerRamadanSections(data: data)
            }
        }
        .listStyle(.insetGrouped)
        .listSectionSpacing(.compact)
        .navigationTitle(format.text(area.title))
        .navigationBarTitleDisplayMode(.inline)
    }
}

/// A khatmah to finish by a date, and what that takes each day.
struct TrackerQuranGoalSection: View {
    let data: TrackerData
    @Environment(AppEnvironment.self) private var app

    var body: some View {
        let goal = data.settings.app.quranGoal
        Section {
            Toggle(isOn: Binding(
                get: { goal != nil },
                set: { on in
                    app.settings.update { $0.app.quranGoal = on ? QuranGoal(start: data.today, end: data.today.adding(days: 30)) : nil }
                }
            )) {
                Text("Finish a khatmah by a date", tableName: "Tracker")
            }
            if let goal {
                DatePicker(selection: Binding(
                    get: { date(of: goal.end) },
                    set: { value in
                        let day = DayKey(value, in: data.clock.timeZone)
                        app.settings.update { $0.app.quranGoal = QuranGoal(start: goal.start, end: max(day, goal.start)) }
                    }
                ), in: date(of: data.today)..., displayedComponents: .date) {
                    Text("Finish by", tableName: "Tracker")
                }
                Text(standing(goal))
                    .font(.subheadline)
                    .foregroundStyle(.indigo)
            }
        }
    }

    private func standing(_ goal: QuranGoal) -> LocalizedStringResource {
        switch goal.standing(today: data.today, progress: data.quran) {
        case let .onTheWay(pages): SeasonL("To reach your goal: \(pages) pages a day")
        case .met: SeasonL("Goal reached")
        case .passed: LocalizedStringResource("The date has passed", table: "Tracker")
        }
    }

    /// Noon of a day at the place, so the picker shows that day whatever the zone.
    private func date(of day: DayKey) -> Date {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = data.clock.timeZone
        return calendar.date(from: DateComponents(year: day.year, month: day.month, day: day.day, hour: 12)) ?? .now
    }
}

/// Where the reading stands, and the day each khatmah was finished.
struct TrackerQuranSection: View {
    let data: TrackerData
    @Environment(\.trackerFormat) private var format

    var body: some View {
        let quran = data.quran
        Section {
            LabeledContent {
                Text("\(quran.position) of \(QuranProgress.pageCount)", tableName: "Tracker").monospacedDigit()
            } label: {
                Label { Text("Current page", tableName: "Tracker") } icon: { Image(systemName: "book.pages.fill").foregroundStyle(.green) }
            }
            if let start = quran.currentKhatmahStart {
                LabeledContent {
                    Text(format.fullDay(start))
                } label: {
                    Label { Text("This khatmah began", tableName: "Tracker") } icon: { Image(systemName: "flag.fill").foregroundStyle(.teal) }
                }
            }
        }

        if !quran.khatmahDates.isEmpty {
            Section {
                ForEach(Array(quran.khatmahDates.enumerated().reversed()), id: \.offset) { index, day in
                    LabeledContent {
                        Text(format.fullDay(day))
                    } label: {
                        Text("Khatmah \(index + 1)", tableName: "Tracker").monospacedDigit()
                    }
                }
            } header: {
                Text("Finished", tableName: "Tracker")
            }
        }
    }
}

/// What was read of the Qur'an on a day, entry by entry. Absent when nothing was.
struct TrackerDayQuranSection: View {
    let data: TrackerData
    let day: DayKey
    @Environment(\.trackerFormat) private var format

    var body: some View {
        let entries = data.records.quran.filter { $0.day == day }
        if !entries.isEmpty {
            Section {
                ForEach(entries) { entry in
                    LabeledContent {
                        Text(format.time(entry.at)).monospacedDigit()
                    } label: {
                        Label {
                            switch entry.kind {
                            case .read: Text("To page \(entry.toPage), \(entry.pages) pages", tableName: "Tracker")
                            case .khatmah: Text("Khatmah added", tableName: "Tracker")
                            }
                        } icon: {
                            Image(systemName: entry.kind == .read ? "book.pages.fill" : "checkmark.seal.fill").foregroundStyle(.green)
                        }
                    }
                }
            } header: {
                Text("Quran", tableName: "Tracker")
            }
        }
        let hifz = data.records.hifz.filter { $0.day == day }
        if !hifz.isEmpty {
            Section {
                ForEach(hifz) { entry in
                    LabeledContent {
                        Text(format.time(entry.at)).monospacedDigit()
                    } label: {
                        Label {
                            Text(verbatim: format.string(hifzLine(entry)))
                        } icon: {
                            Image(systemName: entry.kind == .forgotten ? "arrow.uturn.backward" : "brain.head.profile").foregroundStyle(.purple)
                        }
                    }
                }
            } header: {
                Text("Memorisation", tableName: "Tracker")
            }
        }
    }

    private func hifzLine(_ entry: HifzEntry) -> LocalizedStringResource {
        let name = format.isArabic ? data.quranIndex.suraName(number: entry.sura) : data.quranIndex.suraTransliteration(number: entry.sura)
        return switch entry.kind {
        case .memorised: LocalizedStringResource("Memorised \(name)", table: "Tracker")
        case .reviewed: LocalizedStringResource("Reviewed \(name)", table: "Tracker")
        case .forgotten: LocalizedStringResource("Took \(name) off the memorised list", table: "Tracker")
        }
    }
}

extension TrackerArea {
    var title: LocalizedStringResource {
        switch self {
        case .prayers: LocalizedStringResource("Prayers", table: "Tracker")
        case .azkar: LocalizedStringResource("Azkar", table: "Tracker")
        case .quran: LocalizedStringResource("Quran", table: "Tracker")
        case .fasting: LocalizedStringResource("Fasting", table: "Tracker")
        case .ramadan: SeasonL("Ramadan and Eid")
        }
    }

    var symbol: String {
        switch self {
        case .prayers: "building.columns.fill"
        case .azkar: "book.closed.fill"
        case .quran: "book.pages.fill"
        case .fasting: TrackerMark.fast
        case .ramadan: "moon.stars.fill"
        }
    }

    var tint: Color {
        switch self {
        case .prayers: .green
        case .azkar: .indigo
        case .quran: .teal
        case .fasting: .orange
        case .ramadan: .indigo
        }
    }
}
