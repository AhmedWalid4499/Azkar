import AzkarKit
import SwiftUI

/// The occasions of a Hijri year with their dates in both calendars and how far off they are.
/// The next one stands out; the arrows move between years.
struct IslamicCalendarScreen: View {
    @Environment(AppEnvironment.self) private var app
    @Environment(\.todayFormat) private var format
    let today: DayKey
    @State private var chosenYear: Int?

    private static let yearsAround = 10

    var body: some View {
        let offset = app.settings.settings.app.hijriOffset
        let currentYear = HijriCalendar.date(of: today, offset: offset).year
        let year = chosenYear ?? currentYear
        let occasions = IslamicOccasions.dates(hijriYear: year, offset: offset)
        let next = occasions.first { $0.last >= today }
        List {
            Section {
                ForEach(occasions, id: \.self) { dates in
                    OccasionRow(dates: dates, today: today, offset: offset, isNext: dates == next)
                }
            } header: {
                yearPicker(year, around: currentYear)
            } footer: {
                Text(SeasonL("Dates follow the Umm al-Qura calendar with your Hijri date adjustment. Local moon sighting can differ by a day or two."))
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle(Text(SeasonL("Islamic calendar")))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.visible, for: .navigationBar)
    }

    private func yearPicker(_ year: Int, around current: Int) -> some View {
        HStack {
            yearButton(to: year - 1, around: current, symbol: "chevron.backward", label: SeasonL("Previous year"))
            Spacer()
            Text(verbatim: HijriFormat.year(HijriDate(year: year, month: 1, day: 1), locale: format.displayLocale))
                .font(.headline)
                .foregroundStyle(Color.primary)
                .contentTransition(.numericText())
            Spacer()
            yearButton(to: year + 1, around: current, symbol: "chevron.forward", label: SeasonL("Next year"))
        }
        .textCase(nil)
        .padding(.bottom, 4)
    }

    private func yearButton(to year: Int, around current: Int, symbol: String, label: LocalizedStringResource) -> some View {
        Button {
            withAnimation(.snappy) { chosenYear = year }
        } label: {
            Label { Text(label) } icon: { Image(systemName: symbol) }
                .labelStyle(.iconOnly)
                .font(.headline)
                .frame(width: 44, height: 44)
                .contentShape(.rect)
        }
        .buttonStyle(.borderless)
        .disabled(abs(year - current) > Self.yearsAround)
    }
}

private struct OccasionRow: View {
    @Environment(\.todayFormat) private var format
    let dates: OccasionDates
    let today: DayKey
    let offset: Int
    let isNext: Bool

    var body: some View {
        let passed = dates.last < today
        HStack(spacing: 12) {
            Image(systemName: dates.occasion.symbol)
                .font(.title3)
                .foregroundStyle(dates.occasion.tint)
                .frame(width: 36)
            VStack(alignment: .leading, spacing: 2) {
                Text(dates.occasion.title)
                    .font(.body.weight(.medium))
                Text(verbatim: hijri)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                Text(verbatim: format.dayRange(dates.first, dates.last))
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            Spacer(minLength: 8)
            Text(verbatim: status)
                .font(.subheadline.weight(isNext ? .semibold : .regular))
                .foregroundStyle(isNext ? AnyShapeStyle(dates.occasion.tint) : AnyShapeStyle(.secondary))
                .multilineTextAlignment(.trailing)
                .monospacedDigit()
        }
        .opacity(passed ? 0.55 : 1)
        .padding(.vertical, 2)
        .accessibilityElement(children: .combine)
        .listRowBackground(isNext ? dates.occasion.tint.opacity(0.12) : nil)
    }

    private var hijri: String {
        let first = HijriCalendar.date(of: dates.first, offset: offset)
        if dates.isSingleDay { return HijriFormat.dayAndMonth(first, locale: format.displayLocale) }
        return HijriFormat.dayRange(first, HijriCalendar.date(of: dates.last, offset: offset), locale: format.displayLocale)
    }

    private var status: String {
        if !dates.isSingleDay, let day = dates.dayNumber(of: today) {
            return format.string(SeasonL("Day \(day) of \(dates.dayCount)"))
        }
        return format.string(seasonCountdown(from: today, to: dates.first > today ? dates.first : dates.last))
    }
}
