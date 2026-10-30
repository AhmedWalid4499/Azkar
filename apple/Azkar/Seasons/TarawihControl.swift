import AzkarKit
import SwiftUI

extension WorshipPlace {
    var title: LocalizedStringResource {
        switch self {
        case .masjid: SeasonL("At the masjid")
        case .home: SeasonL("At home")
        }
    }

    var symbol: String {
        switch self {
        case .masjid: "building.columns"
        case .home: "house"
        }
    }
}

extension AppEnvironment {
    /// Writes a deed of the season for a day; no place and no rakahs for a deed that has none.
    func saveSeason(_ deed: SeasonDeed, place: WorshipPlace? = nil, rakahs: Int? = nil, on day: DayKey) {
        Task {
            do {
                try await records.setSeasonRecord(deed, place: place, rakahs: rakahs, on: day)
            } catch {
                print("Seasons: saving \(deed) on \(day) failed: \(error)")
            }
        }
    }

    func clearSeason(_ deed: SeasonDeed, on day: DayKey) {
        Task {
            do {
                try await records.clearSeasonRecord(deed, on: day)
            } catch {
                print("Seasons: clearing \(deed) on \(day) failed: \(error)")
            }
        }
    }
}

/// A night's tarawih: where it was prayed, and how many rakahs if the user wants to say. A second
/// tap on the place clears the night.
struct TarawihControl: View {
    @Environment(AppEnvironment.self) private var app
    let record: SeasonRecord?
    let evening: DayKey

    private static let rakahChoices = Array(stride(from: 2, through: 36, by: 2))

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                ForEach(WorshipPlace.allCases, id: \.self) { place in
                    placeButton(place)
                }
            }
            if let record {
                Picker(selection: Binding(
                    get: { record.rakahs },
                    set: { app.saveSeason(.tarawih, place: record.place, rakahs: $0, on: evening) }
                )) {
                    Text(SeasonL("Not counted")).tag(Int?.none)
                    ForEach(Self.rakahChoices, id: \.self) { rakahs in
                        Text(verbatim: rakahs.formatted()).tag(Int?.some(rakahs))
                    }
                } label: {
                    Text(SeasonL("Rakahs"))
                }
                .pickerStyle(.menu)
            }
        }
        .sensoryFeedback(.selection, trigger: record?.place)
    }

    private func placeButton(_ place: WorshipPlace) -> some View {
        let chosen = record?.place == place
        return Button {
            if chosen {
                app.clearSeason(.tarawih, on: evening)
            } else {
                app.saveSeason(.tarawih, place: place, rakahs: record?.rakahs, on: evening)
            }
        } label: {
            Label { Text(place.title) } icon: { Image(systemName: chosen ? "checkmark" : place.symbol) }
                .font(.subheadline.weight(.medium))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
                .background(chosen ? AnyShapeStyle(Color.indigo) : AnyShapeStyle(Color.indigo.opacity(0.12)), in: .capsule)
                .foregroundStyle(chosen ? AnyShapeStyle(.white) : AnyShapeStyle(Color.indigo))
                .contentShape(.capsule)
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(chosen ? .isSelected : [])
    }
}

/// Today's night in Ramadan, from Maghrib until Fajr: the way to log its tarawih.
struct TarawihSection: View {
    @Environment(AppEnvironment.self) private var app
    let context: TodayContext

    var body: some View {
        let evening = context.beforeDawn ? context.yesterday : context.today
        if isEvening, let night = RamadanCalendar.night(onEvening: evening, offset: app.settings.settings.app.hijriOffset) {
            Section {
                VStack(alignment: .leading, spacing: 12) {
                    Label {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(SeasonL("Tarawih"))
                                .font(.headline)
                            Text(night.isLastTen ? SeasonL("Night \(night.number) of Ramadan, in the last ten") : SeasonL("Night \(night.number) of Ramadan"))
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                    } icon: {
                        Image(systemName: "moon.stars.fill").foregroundStyle(.indigo).font(.title2)
                    }
                    .accessibilityElement(children: .combine)
                    TarawihControl(record: app.records.records.seasons[evening]?[.tarawih], evening: evening)
                }
                .padding(.vertical, 4)
            }
        }
    }

    private var isEvening: Bool {
        if context.beforeDawn { return true }
        if let maghrib = context.todayTimes?[.maghrib] { return context.now >= maghrib }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = context.timeZone
        return calendar.component(.hour, from: context.now) >= 18
    }
}
