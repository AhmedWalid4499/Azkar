import AzkarKit
import SwiftUI

/// The Memorised list: what is held, the daily plan, what is due for review today, then every
/// surah held (wholly or in part, the one reviewed longest ago first) and the rest in mushaf order.
/// Everything done here goes on the memorisation log, so nothing is ever overwritten.
struct QuranHifzSections: View {
    @Environment(AppEnvironment.self) private var app
    @Environment(\.readingLocale) private var format
    let mushaf: QuranMushaf
    let entries: [HifzEntry]
    let plans: [HifzPlan]
    let today: DayKey
    let onOpen: (Int) -> Void
    @State private var logging: HifzLogRequest?
    @State private var plansGoal = false
    @State private var endsPlan: HifzPlan?
    @State private var logged = 0

    var body: some View {
        let progress = HifzProgress(entries: entries)
        let due = progress.due(on: today)
        Group {
            summary(progress)
            plan(progress)
            dueSection(due, progress: progress)
            Section {
                ForEach(progress.byLastReview) { held in
                    row(mushaf.suras[held.number - 1], held: held, progress: progress)
                }
            } header: {
                Text(QL("\(progress.memorisedCount) of 114 surahs"))
            } footer: {
                if progress.suras.isEmpty {
                    Text(QL("Mark the surahs you know by heart, and when you review one. This is separate from your place in the khatmah."))
                } else {
                    Text(QL("Longest since review first"))
                }
            }
            Section {
                ForEach(mushaf.suras.filter { progress.suras[$0.number] == nil }) { sura in
                    row(sura, held: nil, progress: progress)
                }
            } header: {
                Text(QL("Not memorised yet"))
            }
        }
    }

    /// The sheets and confirmations, hung on one row so each is presented once.
    private func presentations(_ progress: HifzProgress) -> HifzPresentations {
        HifzPresentations(mushaf: mushaf, progress: progress, plans: plans, logging: $logging, plansGoal: $plansGoal, endsPlan: $endsPlan, logged: logged) { end($0) }
    }

    // MARK: Summary

    private func summary(_ progress: HifzProgress) -> some View {
        let map = HifzMap(progress: progress, today: today)
        return Section {
            HStack(spacing: 20) {
                figure(QL("Surahs"), progress.memorisedCount)
                figure(QL("Ayat"), progress.heldAyat)
                figure(QL("Pages"), map.pagesHeld)
                figure(QL("Juz"), map.juzHeld)
            }
            .padding(.vertical, 2)
            // On a row: presentations hung on a list's Section are not shown.
            .modifier(presentations(progress))
            NavigationLink {
                HifzMapView(mushaf: mushaf, onOpen: onOpen)
            } label: {
                Label { Text(QL("Juz and page map")) } icon: { Image(systemName: "square.grid.3x3.fill") }
            }
            Button {
                logging = HifzLogRequest()
            } label: {
                Label { Text(QL("Log memorisation or a review")) } icon: { Image(systemName: "plus.circle") }
            }
        }
    }

    private func figure(_ title: LocalizedStringResource, _ value: Int) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(title).font(.caption).foregroundStyle(.secondary)
            Text(verbatim: format.number(value)).font(.headline).monospacedDigit()
        }
        .accessibilityElement(children: .combine)
    }

    // MARK: Plan

    @ViewBuilder private func plan(_ progress: HifzProgress) -> some View {
        if let plan = plans.last(where: \.isActive) {
            let standing = HifzPlanStanding(plan: plan, progress: progress, entries: entries, today: today)
            Section {
                VStack(alignment: .leading, spacing: 8) {
                    HStack(alignment: .firstTextBaseline) {
                        Text(verbatim: targetName(plan.target)).font(.headline)
                        Spacer(minLength: 8)
                        Text(QL("By \(format.day(plan.targetDay))"))
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    ProgressView(value: Double(standing.held), total: Double(max(standing.total, 1)))
                        .tint(.purple)
                    Text(QL("\(standing.held) of \(standing.total) ayat · \(standing.daysLeft) days left"))
                        .font(.subheadline)
                        .monospacedDigit()
                        .foregroundStyle(.secondary)
                    Text(balanceText(standing))
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(standing.balance < 0 ? .orange : .green)
                }
                .padding(.vertical, 2)
                if standing.isComplete {
                    Label { Text(QL("Plan complete. Masha’Allah!")) } icon: { Image(systemName: "checkmark.seal.fill").foregroundStyle(.green) }
                } else if standing.todayPortion.isEmpty {
                    Label { Text(QL("Today’s portion is done")) } icon: { Image(systemName: "checkmark.circle.fill").foregroundStyle(.green) }
                } else {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(QL("Today")).font(.caption).foregroundStyle(.secondary)
                        Text(verbatim: format.spans(standing.todayPortion, in: mushaf))
                    }
                    Button {
                        log(.memorised, spans: standing.todayPortion)
                    } label: {
                        Label { Text(QL("I memorised today’s portion")) } icon: { Image(systemName: "checkmark.circle") }
                    }
                    Button {
                        onOpen(mushaf.page(of: AyahRef(sura: standing.todayPortion[0].sura, ayah: standing.todayPortion[0].from)))
                    } label: {
                        Label { Text(QL("Open in the mushaf")) } icon: { Image(systemName: "book.pages") }
                    }
                }
            } header: {
                HStack {
                    Text(QL("Daily plan"))
                    Spacer()
                    Menu {
                        Button { plansGoal = true } label: {
                            Label { Text(QL("New plan")) } icon: { Image(systemName: "arrow.triangle.2.circlepath") }
                        }
                        Button(role: .destructive) { endsPlan = plan } label: {
                            Label { Text(QL("End plan")) } icon: { Image(systemName: "stop.circle") }
                        }
                    } label: {
                        Label { Text(QL("Plan options")) } icon: { Image(systemName: "ellipsis.circle") }
                            .labelStyle(.iconOnly)
                    }
                }
            } footer: {
                if !standing.isComplete, standing.neededPerDay > plan.dailyAyat {
                    Text(QL("To finish on time: \(standing.neededPerDay) ayat a day"))
                }
            }
        } else {
            Section {
                Button {
                    plansGoal = true
                } label: {
                    Label { Text(QL("Set a daily plan")) } icon: { Image(systemName: "calendar.badge.plus") }
                }
            } footer: {
                Text(QL("Aim for a surah, a juz or some ayat by a date, and see each day’s portion."))
            }
        }
    }

    private func targetName(_ target: HifzPlan.Target) -> String {
        switch target {
        case let .sura(sura): format.suraName(mushaf.suras[sura - 1])
        case let .juz(juz): format.string(QL("Juz \(juz)"))
        case let .range(from, to):
            if from.sura == to.sura {
                format.span(AyahSpan(sura: from.sura, from: from.ayah, to: to.ayah), in: mushaf)
            } else {
                "\(format.span(AyahSpan(sura: from.sura, from: from.ayah, to: from.ayah), in: mushaf)) – \(format.span(AyahSpan(sura: to.sura, from: to.ayah, to: to.ayah), in: mushaf))"
            }
        }
    }

    private func balanceText(_ standing: HifzPlanStanding) -> LocalizedStringResource {
        if standing.balance > 0 { return QL("\(standing.balance) ayat ahead") }
        if standing.balance < 0 { return QL("\(-standing.balance) ayat behind") }
        return QL("On track")
    }

    // MARK: Due

    @ViewBuilder private func dueSection(_ due: [HifzProgress.Portion], progress: HifzProgress) -> some View {
        if !progress.suras.isEmpty {
            Section {
                if due.isEmpty {
                    let next = progress.nextDue(from: today)
                    Label {
                        Text(QL("Nothing due today"))
                        if let next { Text(QL("Next review \(format.day(next))")) }
                    } icon: {
                        Image(systemName: "checkmark.circle.fill").foregroundStyle(.green)
                    }
                }
                ForEach(due) { portion in
                    Menu {
                        Section {
                            HifzStrengthButtons { strength in log(.reviewed, spans: [portion.span], strength: strength) }
                        } header: {
                            Text(QL("Reviewed today: how did it go?"))
                        }
                        Button {
                            let span = portion.span
                            logging = HifzLogRequest(kind: .reviewed, sura: span.sura, ayat: span.isWholeSura ? nil : span.from...span.to)
                        } label: {
                            Label { Text(QL("On another day…")) } icon: { Image(systemName: "calendar") }
                        }
                        Button {
                            onOpen(mushaf.page(of: AyahRef(sura: portion.span.sura, ayah: portion.span.from)))
                        } label: {
                            Label { Text(QL("Open in the mushaf")) } icon: { Image(systemName: "book.pages") }
                        }
                    } label: {
                        dueRow(portion)
                    }
                    .buttonStyle(.plain)
                }
            } header: {
                Text(QL("Due for review"))
            }
        }
    }

    private func dueRow(_ portion: HifzProgress.Portion) -> some View {
        let late = portion.dueOn.days(to: today)
        return HStack(spacing: 12) {
            Image(systemName: portion.strength?.symbol ?? "circle.dashed")
                .foregroundStyle(HifzMap.Standing(portion.strength).color)
            VStack(alignment: .leading, spacing: 2) {
                Text(verbatim: format.span(portion.span, in: mushaf)).foregroundStyle(.primary)
                Text(portion.reviews == 0 ? QL("Memorised \(format.day(portion.memorisedOn))") : QL("Last reviewed \(format.day(portion.lastReviewedOn))"))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer(minLength: 8)
            Text(late == 0 ? QL("Today") : QL("\(late) days late"))
                .font(.caption.weight(.medium))
                .monospacedDigit()
                .foregroundStyle(late == 0 ? AnyShapeStyle(.secondary) : AnyShapeStyle(.orange))
        }
        .contentShape(.rect)
    }

    // MARK: Surahs

    private func row(_ sura: QuranSura, held: HifzProgress.Sura?, progress: HifzProgress) -> some View {
        Menu {
            if let held {
                Section {
                    HifzStrengthButtons { strength in log(.reviewed, spans: heldSpans(sura.number, progress), strength: strength) }
                } header: {
                    Text(QL("Reviewed today: how did it go?"))
                }
                if !held.isComplete {
                    Button { log(.memorised, spans: [AyahSpan(sura: sura.number, from: 1, to: sura.ayahCount)]) } label: {
                        Label { Text(QL("Mark the whole surah as memorised")) } icon: { Image(systemName: "checkmark.circle") }
                    }
                }
            } else {
                Button { log(.memorised, spans: [AyahSpan(sura: sura.number, from: 1, to: sura.ayahCount)]) } label: {
                    Label { Text(QL("Mark as memorised")) } icon: { Image(systemName: "checkmark.circle") }
                }
            }
            Button { logging = HifzLogRequest(sura: sura.number, ayat: 1...sura.ayahCount) } label: {
                Label { Text(QL("Log some ayat…")) } icon: { Image(systemName: "text.line.first.and.arrowtriangle.forward") }
            }
            Button { onOpen(sura.page) } label: {
                Label { Text(QL("Open in the mushaf")) } icon: { Image(systemName: "book.pages") }
            }
            if held != nil {
                Button(role: .destructive) { log(.forgotten, spans: [AyahSpan(sura: sura.number, from: 1, to: sura.ayahCount)]) } label: {
                    Label { Text(QL("No longer memorised")) } icon: { Image(systemName: "arrow.uturn.backward") }
                }
            }
        } label: {
            HStack(spacing: 12) {
                Image(systemName: held == nil ? "circle" : held!.isComplete ? "checkmark.circle.fill" : "circle.lefthalf.filled")
                    .foregroundStyle(held == nil ? AnyShapeStyle(.tertiary) : AnyShapeStyle(.tint))
                VStack(alignment: .leading, spacing: 2) {
                    Text(verbatim: format.suraName(sura))
                        .foregroundStyle(.primary)
                    if let held {
                        Text(line(held))
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                Spacer(minLength: 8)
                if !format.isArabic {
                    Text(verbatim: sura.name)
                        .font(.custom(RecitationFont.regular, size: 18, relativeTo: .body))
                        .foregroundStyle(.secondary)
                }
            }
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
    }

    /// The held ayat of a surah, as spans.
    private func heldSpans(_ sura: Int, _ progress: HifzProgress) -> [AyahSpan] {
        QuranLayout.spans(QuranLayout.indexes(ofSura: sura).filter { progress.isHeld(at: $0) })
    }

    private func line(_ held: HifzProgress.Sura) -> LocalizedStringResource {
        let shown = held.reviews > 0 ? held.lastReviewedOn : held.memorisedOn
        let date = format.day(shown)
        if !held.isComplete {
            return held.reviews > 0 ? QL("\(held.heldAyat) of \(held.ayahCount) ayat · Last reviewed \(date)") : QL("\(held.heldAyat) of \(held.ayahCount) ayat · Memorised \(date)")
        }
        return held.reviews > 0 ? QL("Last reviewed \(date)") : QL("Memorised \(date)")
    }

    // MARK: Logging

    private func log(_ kind: HifzEntry.Kind, spans: [AyahSpan], strength: HifzStrength? = nil) {
        Task {
            do {
                try await app.records.logHifz(kind, spans: spans, strength: strength, on: today)
                logged += 1
            } catch {
                print("Quran: logging \(kind) failed: \(error)")
            }
        }
    }

    private func end(_ plan: HifzPlan) {
        Task {
            do {
                try await app.records.endHifzPlan(plan.id)
            } catch {
                print("Quran: ending the plan failed: \(error)")
            }
        }
    }
}

private struct HifzPresentations: ViewModifier {
    @Environment(\.readingLocale) private var format
    let mushaf: QuranMushaf
    let progress: HifzProgress
    let plans: [HifzPlan]
    @Binding var logging: HifzLogRequest?
    @Binding var plansGoal: Bool
    @Binding var endsPlan: HifzPlan?
    let logged: Int
    let end: (HifzPlan) -> Void

    func body(content: Content) -> some View {
        content
            .sensoryFeedback(.success, trigger: logged)
            .sheet(item: $logging) { request in
                HifzLogSheet(mushaf: mushaf, request: request)
                    .appDirection()
                    .environment(\.locale, format.formatting)
                    .environment(\.readingLocale, format)
            }
            .sheet(isPresented: $plansGoal) {
                HifzPlanSheet(mushaf: mushaf, progress: progress, replaces: plans.contains(where: \.isActive))
                    .appDirection()
                    .environment(\.locale, format.formatting)
                    .environment(\.readingLocale, format)
            }
            .confirmationDialog(Text(QL("End this plan?")), isPresented: Binding(get: { endsPlan != nil }, set: { if !$0 { endsPlan = nil } }), titleVisibility: .visible) {
                Button(role: .destructive) {
                    if let plan = endsPlan { end(plan) }
                } label: {
                    Text(QL("End plan"))
                }
            } message: {
                Text(QL("It stays in your records, with everything you memorised."))
            }
    }
}
