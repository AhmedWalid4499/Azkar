import AzkarKit
import SwiftUI

/// Choosing what the tasbih counter counts: one of the dataset's presets, or freely.
struct TasbihPresetSheet: View {
    let presets: [Dhikr]
    /// `nil` for the free count.
    let chosen: String?
    /// `ReaderSettings.showTransliteration`, resolved for the interface language.
    var showsTransliteration = true
    let onChoose: (Dhikr?) -> Void
    @Environment(\.dismiss) private var dismiss
    @Environment(\.readingLocale) private var locale

    var body: some View {
        NavigationStack {
            List {
                ForEach(presets) { preset in
                    Button { onChoose(preset) } label: {
                        HStack(spacing: 12) {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(verbatim: preset.arabic)
                                    .font(.custom(RecitationFont.regular, size: 22, relativeTo: .title3))
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .environment(\.layoutDirection, .rightToLeft)
                                    .foregroundStyle(.primary)
                                if showsTransliteration, let transliteration = preset.transliteration, !transliteration.isEmpty {
                                    Text(verbatim: transliteration)
                                        .font(.subheadline.italic())
                                        .foregroundStyle(.secondary)
                                        .environment(\.layoutDirection, .leftToRight)
                                }
                                if !locale.isArabic {
                                    Text(verbatim: preset.translation)
                                        .font(.footnote)
                                        .foregroundStyle(.secondary)
                                }
                            }
                            checkmark(preset.id == chosen)
                        }
                    }
                    .buttonStyle(.plain)
                    .contentShape(.rect)
                    .accessibilityAddTraits(preset.id == chosen ? .isSelected : [])
                }
                Section {
                    Button { onChoose(nil) } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Free count", tableName: "Reading").foregroundStyle(.primary)
                                Text("Counting with no dhikr chosen", tableName: "Reading")
                                    .font(.footnote)
                                    .foregroundStyle(.secondary)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            checkmark(chosen == nil)
                        }
                    }
                    .buttonStyle(.plain)
                    .contentShape(.rect)
                    .accessibilityAddTraits(chosen == nil ? .isSelected : [])
                }
            }
            .navigationTitle(Text("Choose a dhikr", tableName: "Reading"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button(role: .close) { dismiss() }
                }
            }
        }
    }

    @ViewBuilder
    private func checkmark(_ isOn: Bool) -> some View {
        if isOn {
            Image(systemName: "checkmark")
                .font(.body.weight(.semibold))
                .foregroundStyle(Color.accentColor)
                .accessibilityHidden(true)
        }
    }
}

/// A target of the user's own, 1 to `ReaderSettings.maxTasbihTarget`.
struct TasbihCustomTargetSheet: View {
    let target: Int?
    let onSave: (Int) -> Void
    @Environment(\.dismiss) private var dismiss
    @Environment(\.readingLocale) private var locale
    @State private var value: Int?
    @FocusState private var focused: Bool

    private var isValid: Bool {
        guard let value else { return false }
        return (1...ReaderSettings.maxTasbihTarget).contains(value)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField(value: $value, format: .number.locale(locale.formatting).grouping(.never)) {
                        Text("Custom target", tableName: "Reading")
                    }
                    .keyboardType(.numberPad)
                    .focused($focused)
                    .font(.title2.monospacedDigit())
                } footer: {
                    if value != nil && !isValid {
                        Text("Enter a whole number from \(locale.number(1)) to \(locale.number(ReaderSettings.maxTasbihTarget)).", tableName: "Reading")
                            .foregroundStyle(.red)
                    } else {
                        Text("A gentle signal each time the count reaches it. Counting carries on.", tableName: "Reading")
                    }
                }
            }
            .navigationTitle(Text("Custom target", tableName: "Reading"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(role: .cancel) { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(role: .confirm) {
                        if let value, isValid {
                            onSave(value)
                            dismiss()
                        }
                    }
                    .disabled(!isValid)
                }
            }
            .onAppear {
                value = target
                focused = true
            }
        }
    }
}
