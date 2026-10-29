import AzkarKit
import SwiftUI

/// How prayer times are calculated: method, Asr school, the high-latitude rule, polar days, and
/// minute adjustments. "Automatic" says what it stands for at the saved place.
struct SettingsCalculationView: View {
    @Environment(AppEnvironment.self) private var app
    @Environment(\.locale) private var locale

    private var config: CalculationConfig { app.settings.settings.calculation }
    private var location: SavedLocation? { app.settings.settings.location }
    private var place: PrayerPlace? { location.flatMap(PrayerPlace.init) }
    private var resolved: ResolvedCalculation { config.resolved(at: place) }

    var body: some View {
        Form {
            Section {
                Picker(selection: binding(\.method)) {
                    Text(SettingsText.string("Automatic", locale: locale)).tag(AutoOr<CalculationMethodID>.auto)
                    ForEach(CalculationMethodID.allCases, id: \.self) { method in
                        Text(SettingsText.method(method, locale: locale)).tag(AutoOr<CalculationMethodID>.fixed(method))
                    }
                } label: {
                    Text("Calculation method", tableName: SettingsText.table)
                }
                .pickerStyle(.navigationLink)
            } footer: {
                Text(automatic(SettingsText.method(resolved.method, locale: locale)))
            }

            Section {
                Picker(selection: binding(\.madhab)) {
                    Text(SettingsText.string("Automatic", locale: locale)).tag(AutoOr<Madhab>.auto)
                    ForEach(Madhab.allCases, id: \.self) { madhab in
                        Text(SettingsText.madhab(madhab, locale: locale)).tag(AutoOr<Madhab>.fixed(madhab))
                    }
                } label: {
                    Text("Asr time", tableName: SettingsText.table)
                }
            } footer: {
                VStack(alignment: .leading, spacing: 4) {
                    if config.madhab == .auto {
                        Text(automatic(SettingsText.madhab(resolved.madhab, locale: locale)))
                    }
                    Text("Standard follows the Shafi‘i, Maliki and Hanbali schools. Hanafi places Asr later.", tableName: SettingsText.table)
                }
            }

            Section {
                Picker(selection: binding(\.highLatitudeRule)) {
                    Text(SettingsText.string("Automatic", locale: locale)).tag(AutoOr<HighLatitudeRuleID>.auto)
                    ForEach(HighLatitudeRuleID.allCases, id: \.self) { rule in
                        Text(SettingsText.highLatitudeRule(rule, locale: locale)).tag(AutoOr<HighLatitudeRuleID>.fixed(rule))
                    }
                } label: {
                    Text("High-latitude rule", tableName: SettingsText.table)
                }
                if showsPolar {
                    Toggle(isOn: polarBinding) {
                        Text("Polar day and night", tableName: SettingsText.table)
                        Text("When the sun doesn’t rise, doesn’t set, or stays too close to the horizon, use the times of the nearest latitude where every time can be calculated.", tableName: SettingsText.table)
                    }
                }
            } footer: {
                VStack(alignment: .leading, spacing: 4) {
                    if config.highLatitudeRule == .auto {
                        Text(automatic(SettingsText.highLatitudeRule(resolved.highLatitudeRule, locale: locale)))
                    }
                    Text("Caps Fajr and Isha at high latitudes around midsummer, when twilight lasts most or all of the night.", tableName: SettingsText.table)
                }
            }

            Section {
                NavigationLink(value: SettingsPage.adjustments) {
                    LabeledContent {
                        Text(adjustmentsSummary)
                    } label: {
                        Text("Fine-tune times", tableName: SettingsText.table)
                    }
                }
            } footer: {
                Text("Calculation methods differ from region to region, and each mosque follows one of them. Choose the settings your local mosque uses so these times match its timetable.", tableName: SettingsText.table)
            }
        }
        .navigationTitle(Text("Prayer times", tableName: SettingsText.table))
        .navigationBarTitleDisplayMode(.inline)
    }

    /// The polar option matters only near the poles; it stays visible once chosen.
    private var showsPolar: Bool {
        config.polar != .unresolved || location.map { PrayerCalculator.isPolarLatitude($0.latitude) } ?? false
    }

    private func automatic(_ name: String) -> String {
        place == nil
            ? SettingsText.string("Automatic uses \(name) until a location is set.", locale: locale)
            : SettingsText.string("Automatic uses \(name) here.", locale: locale)
    }

    private var adjustmentsSummary: String {
        let changed = TimeSlot.allCases.filter { config.adjustments[$0] != 0 }
        guard !changed.isEmpty else { return SettingsText.string("None", locale: locale) }
        return changed.map { "\(SettingsText.slot($0, locale: locale)) \(SettingsText.signed(config.adjustments[$0], locale: locale))" }
            .formatted(.list(type: .and, width: .narrow).locale(locale))
    }

    private func binding<Value>(_ path: WritableKeyPath<CalculationConfig, Value>) -> Binding<Value> {
        Binding(
            get: { app.settings.settings.calculation[keyPath: path] },
            set: { value in app.settings.update { $0.calculation[keyPath: path] = value } }
        )
    }

    private var polarBinding: Binding<Bool> {
        Binding(
            get: { config.polar == .nearestLatitude },
            set: { on in app.settings.update { $0.calculation.polar = on ? .nearestLatitude : .unresolved } }
        )
    }
}

/// Moves each time earlier or later by up to 30 minutes, to match a mosque's timetable.
struct SettingsAdjustmentsView: View {
    @Environment(AppEnvironment.self) private var app
    @Environment(\.locale) private var locale
    @Environment(\.dynamicTypeSize) private var typeSize

    private var adjustments: Adjustments { app.settings.settings.calculation.adjustments }

    var body: some View {
        Form {
            Section {
                ForEach(TimeSlot.allCases) { slot in
                    Stepper(value: binding(slot), in: -Adjustments.limit...Adjustments.limit) {
                        // At the largest text sizes the value goes under the name.
                        let layout = typeSize.isAccessibilitySize ? AnyLayout(VStackLayout(alignment: .leading, spacing: 2)) : AnyLayout(HStackLayout())
                        layout {
                            Text(SettingsText.slot(slot, locale: locale))
                            Spacer(minLength: 8)
                            Text(SettingsText.shortMinutes(adjustments[slot], locale: locale))
                                .monospacedDigit()
                                .foregroundStyle(.secondary)
                                .contentTransition(.numericText(value: Double(adjustments[slot])))
                        }
                    }
                    .accessibilityValue(Text(SettingsText.minutes(adjustments[slot], locale: locale)))
                }
            } footer: {
                Text(SettingsText.string("Move each time earlier or later by up to \(Adjustments.limit) minutes so it matches your mosque’s timetable.", locale: locale))
            }
            Section {
                Button(role: .destructive) {
                    app.settings.update { $0.calculation.adjustments = .none }
                } label: {
                    Text("Reset all to zero", tableName: SettingsText.table)
                }
                .disabled(adjustments == .none)
            }
        }
        .sensoryFeedback(.selection, trigger: adjustments)
        .navigationTitle(Text("Fine-tune times", tableName: SettingsText.table))
        .navigationBarTitleDisplayMode(.inline)
    }

    private func binding(_ slot: TimeSlot) -> Binding<Int> {
        Binding(
            get: { adjustments[slot] },
            set: { value in app.settings.update { $0.calculation.adjustments[slot] = value } }
        )
    }
}

#Preview {
    NavigationStack { SettingsCalculationView() }
        .environment(try! AppEnvironment())
}
