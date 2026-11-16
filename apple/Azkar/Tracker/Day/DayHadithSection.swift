import AzkarKit
import SwiftUI

/// The hadith of the day read on this day, if it was; tapping shows it again. Absent otherwise.
struct TrackerDayHadithSection: View {
    let records: DayRecords
    @Environment(\.locale) private var locale
    @State private var showing = false

    var body: some View {
        if let number = records.hadithRead {
            Section {
                Button {
                    showing = true
                } label: {
                    LabeledContent {
                        Text(H("No. \(number.hadithNumber(locale))")).monospacedDigit()
                    } label: {
                        Label {
                            Text(H("Hadith of the day read")).foregroundStyle(.primary)
                        } icon: {
                            Image(systemName: "text.book.closed.fill").foregroundStyle(.teal)
                        }
                    }
                    .contentShape(.rect)
                }
                .buttonStyle(.plain)
                .sheet(isPresented: $showing) { TrackerHadithSheet(number: number) }
            } header: {
                Text(H("Riyad as-Salihin"))
            }
        }
    }
}

private struct TrackerHadithSheet: View {
    let number: Int
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            HadithNumberView(number: number)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        SheetButton(.close) { dismiss() }
                    }
                }
        }
        .appDirection()
    }
}
