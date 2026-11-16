import AzkarKit
import SwiftUI

/// What turning menstrual mode on does, asked before it happens.
struct MenstrualModeSheet: View {
    let onTurnOn: () -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 28) {
                    VStack(alignment: .leading, spacing: 10) {
                        MenstrualBadge(size: 56)
                            .padding(.bottom, 6)
                        Text(M("For women"))
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Color.menstrual)
                        Text(M("Turn on menstrual mode?"))
                            .font(.largeTitle.bold())
                            .fixedSize(horizontal: false, vertical: true)
                        Text(M("While it’s on, Azkar adjusts to these days. Until you turn it off:"))
                            .font(.body)
                            .foregroundStyle(.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }

                    VStack(alignment: .leading, spacing: 22) {
                        row("checkmark.seal.fill", M("Prayers are marked as excused"),
                            M("Your streaks and stats stay as they are, and an excused prayer is never owed."))
                        row("bell.slash.fill", M("Prayer reminders pause"),
                            M("Prayer times, “not logged yet”, the adhan and the fasting reminders. Your azkar reminders carry on."))
                        row("moon.fill", M("In Ramadan, fasts are excused too"),
                            M("Each day is logged as an excused fast, so the days to make up are counted for you."))
                        row("sparkles", M("A guide for these days"),
                            M("The worship you can still do, one tap away on Today."))
                    }
                }
                .padding(.horizontal, 24)
                .padding(.top, 8)
                .padding(.bottom, 24)
            }
            .safeAreaInset(edge: .bottom) {
                VStack(spacing: 6) {
                    Button {
                        onTurnOn()
                        dismiss()
                    } label: {
                        Text(M("Yes, turn it on"))
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 6)
                    }
                    .prominentButtonStyle()
                    Button {
                        dismiss()
                    } label: {
                        Text(M("Cancel")).frame(maxWidth: .infinity).padding(.vertical, 6)
                    }
                    .buttonStyle(.borderless)
                }
                .padding(.horizontal, 24)
                .padding(.top, 10)
                .padding(.bottom, 8)
                .background(.bar)
            }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    SheetButton(.close) { dismiss() }
                }
            }
        }
        .tint(.menstrual)
    }

    private func row(_ symbol: String, _ title: LocalizedStringResource, _ detail: LocalizedStringResource) -> some View {
        HStack(alignment: .top, spacing: 16) {
            Image(systemName: symbol)
                .font(.title3)
                .foregroundStyle(Color.menstrual)
                .frame(width: 30)
            VStack(alignment: .leading, spacing: 4) {
                Text(title).font(.headline)
                Text(detail)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .accessibilityElement(children: .combine)
    }
}

/// The mode's mark: a crescent and stars on a wash of its indigo.
struct MenstrualBadge: View {
    var size: CGFloat = 40

    var body: some View {
        Image(systemName: "moon.stars.fill")
            .font(.system(size: size * 0.46, weight: .semibold))
            .foregroundStyle(Color.menstrual)
            .frame(width: size, height: size)
            .background(Color.menstrualWash, in: .rect(cornerRadius: size * 0.28, style: .continuous))
            .accessibilityHidden(true)
    }
}

#Preview {
    Text(verbatim: "Today").sheet(isPresented: .constant(true)) { MenstrualModeSheet {} }
}
