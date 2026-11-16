import AzkarKit
import SwiftUI

/// Sets a memorisation goal: a surah, a juz or a stretch of ayat by a date, so much a day. It
/// starts today and replaces a plan already running (which stays in the records, ended).
struct HifzPlanSheet: View {
    private enum Scope: Hashable { case sura, juz, range }

    @Environment(AppEnvironment.self) private var app
    @Environment(\.dismiss) private var dismiss
    @Environment(\.readingLocale) private var format
    let mushaf: QuranMushaf
    let progress: HifzProgress
    let replaces: Bool
    @State private var scope = Scope.sura
    @State private var sura = 67
    @State private var juz = 30
    @State private var fromSura = 2
    @State private var fromAyah = 1
    @State private var toSura = 2
    @State private var toAyah = 141
    @State private var finishBy = Date.now.addingTimeInterval(30 * 86_400)
    @State private var chosesDefault = true
    /// `nil` until changed by hand: then what the dates ask for.
    @State private var chosenDaily: Int?

    private var target: HifzPlan.Target? {
        let target: HifzPlan.Target = switch scope {
        case .sura: .sura(sura)
        case .juz: .juz(juz)
        case .range: .range(from: AyahRef(sura: fromSura, ayah: fromAyah), to: AyahRef(sura: toSura, ayah: toAyah))
        }
        return target.isValid ? target : nil
    }

    var body: some View {
        let timeZone = app.settings.settings.timeZone
        let today = DayKey(.now, in: timeZone)
        let targetDay = max(DayKey(finishBy, in: timeZone), today)
        let left = target.map { $0.indexes.filter { !progress.isHeld(at: $0) }.count } ?? 0
        let suggested = target.map { HifzPlan.dailyAyat(for: $0, from: today, to: targetDay, progress: progress) } ?? 1
        let daily = chosenDaily ?? suggested
        NavigationStack {
            Form {
                Section {
                    Picker(selection: $scope) {
                        Text(QL("Surah")).tag(Scope.sura)
                        Text(QL("Juz")).tag(Scope.juz)
                        Text(QL("Ayat")).tag(Scope.range)
                    } label: {
                        Text(QL("Goal"))
                    }
                    .pickerStyle(.segmented)
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets())
                }
                Section {
                    switch scope {
                    case .sura:
                        HifzSuraPicker(title: QL("Surah"), mushaf: mushaf, sura: $sura)
                    case .juz:
                        Picker(selection: $juz) {
                            ForEach(1...30, id: \.self) { number in
                                Text(QL("Juz \(number)")).tag(number)
                            }
                        } label: {
                            Text(QL("Juz"))
                        }
                        .pickerStyle(.navigationLink)
                    case .range:
                        HifzSuraPicker(title: QL("From surah"), mushaf: mushaf, sura: $fromSura)
                        HifzNumberField(title: QL("From ayah"), value: $fromAyah, range: 1...mushaf.suras[fromSura - 1].ayahCount)
                        HifzSuraPicker(title: QL("To surah"), mushaf: mushaf, sura: $toSura)
                        HifzNumberField(title: QL("To ayah"), value: $toAyah, range: 1...mushaf.suras[toSura - 1].ayahCount)
                    }
                } footer: {
                    if let target {
                        Text(QL("\(left) of \(target.indexes.count) ayat still to memorise"))
                    } else {
                        Text(QL("Choose ayat that run forwards through the mushaf.")).foregroundStyle(.red)
                    }
                }
                Section {
                    DatePicker(selection: $finishBy, in: Date.now..., displayedComponents: .date) {
                        Text(QL("Finish by"))
                    }
                    Stepper(value: Binding(get: { daily }, set: { chosenDaily = $0 }), in: 1...HifzPlan.maxDailyAyat) {
                        Text(QL("\(daily) ayat a day"))
                            .monospacedDigit()
                    }
                } footer: {
                    let days = left == 0 ? 0 : Int((Double(left) / Double(daily)).rounded(.up))
                    Text(QL("At this pace you finish on \(format.day(today.adding(days: max(days - 1, 0))))."))
                }
                if replaces {
                    Section {
                        Text(QL("Your current plan ends and stays in your records."))
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .navigationTitle(Text(QL("Memorisation plan")))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    SheetButton(.close) { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    SheetButton(.confirm) {
                        if let target { start(target, today: today, targetDay: targetDay, daily: daily) }
                    } label: {
                        Text(QL("Start"))
                    }
                    .disabled(target == nil)
                }
            }
            .onChange(of: target) { _, _ in chosenDaily = nil }
            .onAppear {
                // A surah begun and not finished, else the first from the end not held at all.
                guard chosesDefault else { return }
                chosesDefault = false
                if let partial = progress.suras.values.filter({ !$0.isComplete }).map(\.number).min() {
                    sura = partial
                } else if let next = (1...114).reversed().first(where: { progress.suras[$0] == nil }) {
                    sura = next
                }
            }
            .onChange(of: finishBy) { _, _ in chosenDaily = nil }
        }
    }

    private func start(_ target: HifzPlan.Target, today: DayKey, targetDay: DayKey, daily: Int) {
        Task {
            do {
                try await app.records.startHifzPlan(target, from: today, to: targetDay, dailyAyat: daily)
            } catch {
                print("Quran: starting the plan failed: \(error)")
            }
        }
        dismiss()
    }
}
