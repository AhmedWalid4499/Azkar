import AzkarKit
import SwiftUI

/// The greeting, today's Gregorian and Hijri dates, and the place the times are for. Tapping
/// the Hijri date opens the Islamic calendar, and the place the location sheet.
struct TodayHeader: View {
    @Environment(AppEnvironment.self) private var app
    @Environment(\.todayFormat) private var format
    let context: TodayContext
    @Binding var showsLocation: Bool
    @Binding var showsCalendar: Bool
    @Binding var showsSettings: Bool

    var body: some View {
        let appSettings = app.settings.settings.app
        Section {
            VStack(alignment: .leading, spacing: 6) {
                HStack(alignment: .top) {
                    greeting(name: appSettings.name)
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(.secondary)
                    Spacer(minLength: 8)
                    settingsButton
                }
                Text(format.longDay(context.today))
                    .font(.title2.bold())
                    .accessibilityAddTraits(.isHeader)
                hijriButton(offset: appSettings.hijriOffset)
                placeButton
                    .padding(.top, 4)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .listRowBackground(Color.clear)
            .listRowInsets(EdgeInsets(top: 8, leading: 4, bottom: 4, trailing: 4))
        }
    }

    private func greeting(name: String) -> Text {
        // A name keeps its own direction inside the sentence (an English name in Arabic, say).
        let isolated = "\u{2068}\(name)\u{2069}"
        return name.isEmpty ? Text(L("As-salamu alaykum")) : Text(L("As-salamu alaykum, \(isolated)"))
    }

    private var settingsButton: some View {
        Button {
            showsSettings = true
        } label: {
            Label { Text(L("Settings")) } icon: { Image(systemName: "gearshape") }
                .labelStyle(.iconOnly)
                .font(.title3)
        }
        .buttonBorderShape(.circle)
        .buttonStyle(.glass)
    }

    private func hijriButton(offset: Int) -> some View {
        Button {
            showsCalendar = true
        } label: {
            HStack(alignment: .firstTextBaseline, spacing: 5) {
                Text(format.hijri(context.today, offset: offset))
                Image(systemName: "chevron.forward")
                    .imageScale(.small)
                    .foregroundStyle(.tertiary)
            }
            .font(.subheadline)
            .foregroundStyle(.secondary)
        }
        .buttonStyle(.plain)
        .accessibilityHint(Text(SeasonL("Opens the Islamic calendar")))
    }

    private var placeButton: some View {
        let place = context.location.map(format.place)
        return Button {
            showsLocation = true
        } label: {
            HStack(alignment: .firstTextBaseline, spacing: 5) {
                Image(systemName: context.location?.source == .gps ? "location.fill" : "mappin.and.ellipse")
                    .imageScale(.small)
                if let place {
                    Text(verbatim: place).lineLimit(2)
                } else {
                    Text(L("Location not set"))
                }
                Image(systemName: "chevron.forward")
                    .imageScale(.small)
                    .foregroundStyle(.tertiary)
            }
            .font(.subheadline.weight(.medium))
        }
        .buttonStyle(.borderless)
        .accessibilityLabel(place.map { Text(verbatim: $0) } ?? Text(L("Location not set")))
        .accessibilityHint(Text(L("Change the location prayer times are calculated for")))
    }
}
