import AzkarKit
import SwiftUI

/// What was given: this Hijri year at a glance, the zakat date, and every line of the log. The
/// page records; it never works out what is due.
struct TrackerGivingSections: View {
    let data: TrackerData
    @Environment(\.trackerFormat) private var format
    @State private var adding = false

    var body: some View {
        let offset = data.settings.app.hijriOffset
        let year = HijriCalendar.date(of: data.today, offset: offset).year
        let review = HijriYearReview(hijriYear: year, offset: offset, today: data.today, history: data.history)
        Section {
            Button {
                adding = true
            } label: {
                Label { Text("Log something given", tableName: "Tracker") } icon: { Image(systemName: "plus.circle.fill") }
            }
            .sheet(isPresented: $adding) {
                TrackerGivingSheet(data: data)
            }
            #if DEBUG
            .task {
                guard TrackerShowcase.opens("give") else { return }
                try? await Task.sleep(for: .seconds(1.5))
                adding = true
            }
            #endif
        } footer: {
            Text("This keeps a record of what you give. It doesn’t work out what you owe.", tableName: "Tracker")
        }

        Section {
            ForEach(GivingEntry.Kind.allCases, id: \.self) { kind in
                LabeledContent {
                    TrackerValueStack {
                        Text(verbatim: amounts(review.giving, kind))
                        Text("Logged: \(review.giving.counts[kind] ?? 0)", tableName: "Tracker")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                } label: {
                    Label { format.text(kind.trackerName) } icon: { Image(systemName: kind.trackerSymbol).foregroundStyle(kind.trackerTint) }
                }
                .accessibilityElement(children: .combine)
            }
        } header: {
            Text(verbatim: HijriFormat.year(HijriDate(year: year, month: HijriDate.muharram, day: 1), locale: format.display))
        }

        TrackerZakatDateSection(data: data)

        if !data.records.giving.isEmpty {
            Section {
                ForEach(data.records.giving.reversed()) { entry in
                    TrackerGivingRow(entry: entry)
                }
            } header: {
                Text("History", tableName: "Tracker")
            }
        }
    }

    private func amounts(_ summary: GivingSummary, _ kind: GivingEntry.Kind) -> String {
        let totals = summary.totals[kind] ?? []
        return totals.isEmpty ? "–" : totals.map { format.money($0.amount, $0.currency) }.joined(separator: " · ")
    }
}

/// One line of the log. Its day and time open nothing: taking it out is on the swipe, which never
/// runs at full stretch, so a line can't be lost by accident.
struct TrackerGivingRow: View {
    let entry: GivingEntry
    @Environment(AppEnvironment.self) private var app
    @Environment(\.trackerFormat) private var format

    var body: some View {
        LabeledContent {
            if let amount = entry.amount, let currency = entry.currency {
                Text(verbatim: format.money(amount, currency)).monospacedDigit()
            }
        } label: {
            Label {
                VStack(alignment: .leading, spacing: 2) {
                    format.text(entry.kind.trackerName)
                    Text(format.shortDay(entry.day))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    if let note = entry.note {
                        Text(verbatim: note)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            } icon: {
                Image(systemName: entry.kind.trackerSymbol).foregroundStyle(entry.kind.trackerTint)
            }
        }
        .accessibilityElement(children: .combine)
        .swipeActions(allowsFullSwipe: false) {
            Button(role: .destructive) {
                Task { try? await app.records.removeGiving(entry.id) }
            } label: {
                Label { Text("Delete", tableName: "Tracker") } icon: { Image(systemName: "trash") }
            }
        }
    }
}

/// The day zakat falls due each year, on the Hijri calendar, and the reminders.
private struct TrackerZakatDateSection: View {
    let data: TrackerData
    @Environment(AppEnvironment.self) private var app
    @Environment(\.trackerFormat) private var format

    var body: some View {
        let season = data.settings.reminders.season
        let offset = data.settings.app.hijriOffset
        Section {
            Toggle(isOn: Binding(
                get: { season.zakatDue != nil },
                set: { on in
                    let today = HijriCalendar.date(of: data.today, offset: offset)
                    update { $0.zakatDue = on ? HijriMonthDay(month: today.month, day: today.day) : nil }
                }
            )) {
                Text("I have a yearly zakat date", tableName: "Tracker")
            }
            if let due = season.zakatDue {
                Picker(selection: Binding(get: { due.month }, set: { month in update { $0.zakatDue = HijriMonthDay(month: month, day: due.day) } })) {
                    ForEach(1...12, id: \.self) { month in
                        Text(verbatim: HijriFormat.monthName(month, language: format.display.language)).tag(month)
                    }
                } label: {
                    Text("Month", tableName: "Tracker")
                }
                Picker(selection: Binding(get: { due.day }, set: { day in update { $0.zakatDue = HijriMonthDay(month: due.month, day: day) } })) {
                    ForEach(1...30, id: \.self) { day in
                        Text(verbatim: format.number(day)).tag(day)
                    }
                } label: {
                    Text("Day", tableName: "Tracker")
                }
                if let next = SeasonReminders.nextZakatDay(due, from: data.today, offset: offset) {
                    LabeledContent {
                        Text(format.shortDay(next))
                    } label: {
                        Text("Next", tableName: "Tracker")
                    }
                }
                Toggle(isOn: Binding(get: { season.zakat }, set: { on in update { $0.zakat = on } })) {
                    Text("Remind me on the day", tableName: "Tracker")
                }
            }
            Toggle(isOn: Binding(get: { season.zakatFitr }, set: { on in update { $0.zakatFitr = on } })) {
                Text("Remind me of zakat al-fitr", tableName: "Tracker")
                Text("On the 28th of Ramadan.", tableName: "Tracker")
            }
        } header: {
            Text("Zakat date", tableName: "Tracker")
        }
    }

    private func update(_ change: @escaping (inout SeasonReminderChoices) -> Void) {
        app.settings.update { change(&$0.reminders.season) }
    }
}

/// Logs one thing given, today or on a day gone by. An amount and a note are both left to the user.
struct TrackerGivingSheet: View {
    let data: TrackerData
    @Environment(AppEnvironment.self) private var app
    @Environment(\.trackerFormat) private var format
    @Environment(\.dismiss) private var dismiss
    @State private var kind = GivingEntry.Kind.sadaqah
    @State private var date = Date.now
    @State private var amount = ""
    @State private var currency: String?
    @State private var note = ""
    @State private var saved = 0

    var body: some View {
        let chosen = currency ?? defaultCurrency
        NavigationStack {
            Form {
                Section {
                    Picker(selection: $kind) {
                        ForEach(GivingEntry.Kind.allCases, id: \.self) { kind in
                            format.text(kind.trackerName).tag(kind)
                        }
                    } label: {
                        Text("Kind", tableName: "Tracker")
                    }
                    DatePicker(selection: $date, in: ...data.clock.now, displayedComponents: .date) {
                        Text("Day", tableName: "Tracker")
                    }
                }

                Section {
                    TextField(text: $amount) {
                        Text("Amount", tableName: "Tracker")
                    }
                    .keyboardType(.decimalPad)
                    Picker(selection: Binding(get: { chosen }, set: { currency = $0 })) {
                        ForEach(currencies(including: chosen), id: \.self) { code in
                            Text(verbatim: currencyName(code)).tag(code)
                        }
                    } label: {
                        Text("Currency", tableName: "Tracker")
                    }
                    .pickerStyle(.navigationLink)
                } footer: {
                    if !amount.isEmpty, GivingEntry.parsedAmount(amount) == nil {
                        Text("That doesn’t look like an amount.", tableName: "Tracker")
                    } else {
                        Text("Optional. Leave it empty if you’d rather not say, or gave something else.", tableName: "Tracker")
                    }
                }

                Section {
                    TextField(text: $note, axis: .vertical) {
                        Text("Note (optional)", tableName: "Tracker")
                    }
                    .lineLimit(2...5)
                }
            }
            .navigationTitle(Text("Log something given", tableName: "Tracker"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(role: .cancel) { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(role: .confirm) { save(currency: chosen) }
                        .disabled(!amount.isEmpty && GivingEntry.parsedAmount(amount) == nil)
                }
            }
            .sensoryFeedback(.success, trigger: saved)
        }
        .appDirection()
        .presentationDetents([.large])
    }

    /// The last currency used, else the one of the user's region.
    private var defaultCurrency: String {
        data.records.giving.last(where: { $0.currency != nil })?.currency ?? format.locale.currency?.identifier ?? "USD"
    }

    private func currencies(including code: String) -> [String] {
        Array(Set(Locale.commonISOCurrencyCodes).union([code])).sorted { currencyName($0) < currencyName($1) }
    }

    private func currencyName(_ code: String) -> String {
        format.locale.localizedString(forCurrencyCode: code).map { "\($0) (\(code))" } ?? code
    }

    private func save(currency: String) {
        let day = DayKey(date, in: data.clock.timeZone)
        let entry = GivingEntry(kind: kind, day: day, at: .now, amount: GivingEntry.parsedAmount(amount), currency: currency, note: note)
        Task {
            try? await app.records.logGiving(entry)
            saved += 1
            dismiss()
        }
    }
}

extension GivingEntry.Kind {
    var trackerName: LocalizedStringResource {
        switch self {
        case .sadaqah: LocalizedStringResource("Sadaqah", table: "Tracker")
        case .zakat: LocalizedStringResource("Zakat", table: "Tracker")
        case .zakatAlFitr: LocalizedStringResource("Zakat al-fitr", table: "Tracker")
        }
    }

    var trackerSymbol: String {
        switch self {
        case .sadaqah: "heart.fill"
        case .zakat: "hands.and.sparkles.fill"
        case .zakatAlFitr: "basket.fill"
        }
    }

    var trackerTint: Color {
        switch self {
        case .sadaqah: .pink
        case .zakat: .green
        case .zakatAlFitr: .orange
        }
    }
}
