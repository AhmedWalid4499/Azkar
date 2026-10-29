import AzkarKit
import SwiftUI

/// One day of the month calendar: its number, a mark per prayer (a shape for each status), and
/// marks for the morning and evening azkar and a fast kept. Today is outlined; a day that has
/// not begun shows nothing and cannot be opened.
struct TrackerDayCell: View {
    let data: TrackerData
    let day: DayKey
    let open: () -> Void
    @Environment(\.trackerFormat) private var format

    var body: some View {
        let isToday = day == data.today
        let isFuture = day > data.today
        let records = data.day(day)
        Button(action: open) {
            VStack(spacing: 3) {
                Text(format.dayNumber(day))
                    .font(.callout.weight(isToday ? .bold : .regular).monospacedDigit())
                    .foregroundStyle(isToday ? Color.accentColor : .primary)
                TrackerPrayerMarks(record: isFuture ? nil : records.prayer, hidden: isFuture)
                TrackerOtherMarks(records: records, hidden: isFuture)
            }
            .frame(maxWidth: .infinity, minHeight: 54)
            .padding(.vertical, 3)
            .background {
                if isToday {
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .strokeBorder(Color.accentColor, lineWidth: 1.5)
                }
            }
            .contentShape(.rect(cornerRadius: 10))
        }
        .buttonStyle(TrackerDayCellButtonStyle())
        .disabled(isFuture)
        .opacity(isFuture ? 0.35 : 1)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilityLabel(records, isToday: isToday, isFuture: isFuture))
        .accessibilityHint(isFuture ? Text("") : Text("Opens the day", tableName: "Tracker"))
        .accessibilityAddTraits(isToday ? .isSelected : [])
    }

    private func accessibilityLabel(_ records: DayRecords, isToday: Bool, isFuture: Bool) -> String {
        let date = format.fullDay(day)
        if isFuture { return format.string(LocalizedStringResource("\(date), upcoming", table: "Tracker")) }
        let summary = format.list(TrackerDaySummaryText.parts(records, format: format))
        if isToday { return format.string(LocalizedStringResource("Today, \(date), \(summary)", table: "Tracker")) }
        return format.string(LocalizedStringResource("Day summary: \(date), \(summary)", table: "Tracker"))
    }
}

/// What a day holds, in words, for VoiceOver.
enum TrackerDaySummaryText {
    static func parts(_ records: DayRecords, format: TrackerFormat) -> [String] {
        let summary = PrayerStats.summarize(records.prayer)
        var parts: [String] = []
        if summary.logged == 0 {
            parts.append(format.string(LocalizedStringResource("no prayers logged", table: "Tracker")))
        } else {
            parts.append(format.string(LocalizedStringResource("\(summary.prayed) of \(summary.due) prayed", table: "Tracker")))
            let missed = Prayer.allCases.filter { records.prayer.prayers[$0]?.status == .missed }.map { format.string($0.trackerName) }
            if !missed.isEmpty {
                parts.append(format.string(LocalizedStringResource("missed \(format.list(missed))", table: "Tracker")))
            }
        }
        if records.sessions[.morning]?.completed == true {
            parts.append(format.string(LocalizedStringResource("morning azkar done", table: "Tracker")))
        }
        if records.sessions[.evening]?.completed == true {
            parts.append(format.string(LocalizedStringResource("evening azkar done", table: "Tracker")))
        }
        if let fast = records.fast {
            parts.append(format.string(LocalizedStringResource("\(format.string(fast.kind.trackerName)) fast: \(format.string(fast.status.trackerName))", table: "Tracker")))
        }
        return parts
    }
}

/// Five marks, Fajr to Isha, in the reading direction.
private struct TrackerPrayerMarks: View {
    let record: DayPrayerRecord?
    let hidden: Bool

    var body: some View {
        HStack(spacing: 1.5) {
            ForEach(Prayer.allCases) { prayer in
                let status = record?.prayers[prayer]?.status
                Image(systemName: status?.trackerMark ?? TrackerUnloggedPrayer.mark)
                    .font(.system(size: 6, weight: .heavy))
                    .foregroundStyle(status.map { AnyShapeStyle($0.trackerTint) } ?? AnyShapeStyle(.tertiary))
                    .frame(width: 6.5, height: 7)
            }
        }
        .opacity(hidden ? 0 : 1)
    }
}

/// The morning and evening azkar and a fast kept; an empty place keeps the rows level.
private struct TrackerOtherMarks: View {
    let records: DayRecords
    let hidden: Bool

    var body: some View {
        HStack(spacing: 2) {
            mark(TrackerMark.morning, tint: AzkarSession.morning.trackerTint, shown: records.sessions[.morning]?.completed == true)
            mark(TrackerMark.evening, tint: AzkarSession.evening.trackerTint, shown: records.sessions[.evening]?.completed == true)
            mark(TrackerMark.fast, tint: .pink, shown: records.fast?.status == .fasted)
        }
        .opacity(hidden ? 0 : 1)
    }

    private func mark(_ symbol: String, tint: Color, shown: Bool) -> some View {
        Image(systemName: symbol)
            .font(.system(size: 8, weight: .semibold))
            .foregroundStyle(tint)
            .frame(width: 10, height: 9)
            .opacity(shown ? 1 : 0)
    }
}

/// A press that dims and shrinks a little, as a calendar day does.
private struct TrackerDayCellButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .background {
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(Color.primary.opacity(configuration.isPressed ? 0.08 : 0))
            }
            .scaleEffect(configuration.isPressed ? 0.94 : 1)
            .animation(.snappy(duration: 0.18), value: configuration.isPressed)
    }
}
