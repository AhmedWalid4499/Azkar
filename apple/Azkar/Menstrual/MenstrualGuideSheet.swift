import SwiftUI

/// The worship open to a woman during her period: what scholars agree on, what they differ over,
/// and what is made up afterwards, with the hadith behind it. No health advice.
struct MenstrualGuideSheet: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section {
                    VStack(alignment: .leading, spacing: 10) {
                        MenstrualBadge(size: 48)
                        Text(M("Prayer and fasting are lifted from you in these days, and the door to Allah stays open. Here is what you can keep doing."))
                            .font(.body)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .padding(.vertical, 6)
                }

                Section {
                    item("sparkles", M("Dhikr"), M("Your morning and evening azkar, tasbih, and remembering Allah at any time."))
                    item("hands.sparkles", M("Dua"), M("Ask for whatever you need, whenever you like."))
                    item("heart", M("Istighfar and salawat"), M("Seeking forgiveness, and sending blessings on the Prophet ﷺ."))
                    item("headphones", M("Listening to the Quran"), M("Listen to a recitation, or to a lesson of tafsir."))
                    item("gift", M("Charity"), M("Giving, however little, and helping those around you."))
                    item("book", M("Learning"), M("Reading about the Quran, the hadith and the life of the Prophet ﷺ."))
                } header: {
                    Text(M("What you can still do"))
                } footer: {
                    Text(M("During Hajj the Prophet ﷺ told Aisha, when her period came: “Do all that the pilgrim does, except going around the House until you are pure.” Sahih al-Bukhari 305."))
                }

                Section {
                    Text(M("Scholars differ over reciting the Quran during menstruation: many hold that it is not recited, while others allow it, especially from memory or to keep what was learnt. Most hold that the mushaf itself is not touched directly."))
                        .font(.subheadline)
                        .fixedSize(horizontal: false, vertical: true)
                } header: {
                    Text(M("Reciting the Quran"))
                } footer: {
                    Text(M("Where scholars differ, follow the scholars you trust."))
                }

                Section {
                    Text(M("The prayers of these days are not made up. The fasts of Ramadan are made up later."))
                        .font(.subheadline)
                        .fixedSize(horizontal: false, vertical: true)
                } header: {
                    Text(M("Afterwards"))
                } footer: {
                    Text(M("Aisha said: “We were commanded to make up the fasts, and we were not commanded to make up the prayers.” Sahih Muslim 335."))
                }
            }
            .navigationTitle(Text(M("A guide for these days")))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    SheetButton(.close) { dismiss() }
                }
            }
        }
        .tint(.menstrual)
    }

    private func item(_ symbol: String, _ title: LocalizedStringResource, _ detail: LocalizedStringResource) -> some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: symbol)
                .font(.body.weight(.semibold))
                .foregroundStyle(Color.menstrual)
                .frame(width: 28, height: 28)
                .background(Color.menstrualWash, in: .rect(cornerRadius: 8, style: .continuous))
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.headline)
                Text(detail)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(.vertical, 2)
        .accessibilityElement(children: .combine)
    }
}

#Preview {
    MenstrualGuideSheet()
}
