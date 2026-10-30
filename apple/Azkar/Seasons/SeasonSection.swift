import AzkarKit
import SwiftUI

/// A quiet card on Today when an occasion is near or here. It is absent for most of the year;
/// a tap opens the calendar.
struct SeasonSection: View {
    @Environment(AppEnvironment.self) private var app
    @Environment(\.todayFormat) private var format
    let context: TodayContext
    @Binding var showsCalendar: Bool

    var body: some View {
        if let notice = IslamicOccasions.notice(on: context.today, offset: app.settings.settings.app.hijriOffset) {
            let occasion = notice.dates.occasion
            Section {
                Button {
                    showsCalendar = true
                } label: {
                    HStack(spacing: 12) {
                        Image(systemName: occasion.symbol)
                            .font(.title2)
                            .foregroundStyle(occasion.tint)
                            .frame(width: 32)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(title(notice))
                                .font(.headline)
                                .foregroundStyle(.primary)
                            Text(verbatim: detail(notice))
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
                .accessibilityHint(Text(SeasonL("Opens the Islamic calendar")))

                if case let .today(dates) = notice, dates.occasion != .hijriNewYear {
                    eidPrayer(on: dates.first)
                }
            }
        }
    }

    private func eidPrayer(on day: DayKey) -> some View {
        let prayed = app.records.records.seasons[day]?[.eidPrayer] != nil
        return Toggle(isOn: Binding(
            get: { prayed },
            set: { $0 ? app.saveSeason(.eidPrayer, on: day) : app.clearSeason(.eidPrayer, on: day) }
        )) {
            Text(SeasonL("I prayed the Eid prayer"))
        }
        .sensoryFeedback(.success, trigger: prayed) { _, new in new }
    }

    private func title(_ notice: SeasonNotice) -> LocalizedStringResource {
        if case let .today(dates) = notice, dates.occasion != .hijriNewYear { return SeasonL("Eid Mubarak") }
        return notice.dates.occasion.title
    }

    private func detail(_ notice: SeasonNotice) -> String {
        switch notice {
        case let .today(dates):
            format.string(dates.occasion == .hijriNewYear ? seasonCountdown(from: context.today, to: dates.first) : dates.occasion.title)
        case let .running(dates, day):
            format.string(SeasonL("Day \(day) of \(dates.dayCount)"))
        case let .approaching(dates, _):
            "\(format.string(seasonCountdown(from: context.today, to: dates.first))) · \(format.weekdayAndDate(dates.first))"
        }
    }
}
