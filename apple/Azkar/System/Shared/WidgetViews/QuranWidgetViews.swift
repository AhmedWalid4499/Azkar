import AzkarKit
import SwiftUI
import WidgetKit

// The Quran widget's views, by family. Shared with the app so debug builds can render them.

struct QuranWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: QuranWidgetEntry

    var body: some View {
        switch family {
        case .systemMedium: QuranWidgetMediumView(entry: entry)
        case .accessoryCircular: QuranWidgetCircularView(entry: entry)
        case .accessoryRectangular: QuranWidgetRectangularView(entry: entry)
        case .accessoryInline: QuranWidgetInlineView(entry: entry)
        default: QuranWidgetSmallView(entry: entry)
        }
    }
}

/// "Quran" (in Ramadan, its day), the page reading goes on from, its surah and how far this khatmah is.
private struct QuranWidgetSummary: View {
    let entry: QuranWidgetEntry

    var body: some View {
        let language = entry.language
        VStack(alignment: .leading, spacing: 4) {
            Label {
                Text(verbatim: heading)
            } icon: {
                Image(systemName: entry.ramadan == nil ? "book.pages" : "moon.stars")
            }
            .font(.caption.weight(.semibold))
            .foregroundStyle(.tint)
            .widgetAccentable()
            .lineLimit(1)

            Text(verbatim: entry.quran.hasStarted ? entry.pageTitle : SystemText.string("Start reading", language))
                .font(.title2.weight(.bold))
                .minimumScaleFactor(0.7)
                .lineLimit(1)
            Text(verbatim: entry.suraTitle)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .lineLimit(1)
        }
        .accessibilityElement(children: .combine)
    }

    private var heading: String {
        let language = entry.language
        guard let ramadan = entry.ramadan else { return SystemText.string("Quran", language) }
        guard let day = ramadan.day else { return SystemText.string("Ramadan begins tonight", language) }
        return SystemText.format("Ramadan, day %@", language, SystemText.number(day, language))
    }
}

/// One figure beside the summary: a symbol and a short line.
private struct QuranWidgetFigure: View {
    let symbol: String
    let text: String
    var isDone = false

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: symbol)
                .foregroundStyle(isDone ? AnyShapeStyle(.tint) : AnyShapeStyle(.secondary))
                .widgetAccentable(isDone)
                .frame(width: 16)
            Text(verbatim: text)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
        .font(.footnote)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct QuranWidgetSmallView: View {
    let entry: QuranWidgetEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            QuranWidgetSummary(entry: entry)
            Spacer(minLength: 0)
            WidgetProgressBar(fraction: entry.quran.fraction)
            Text(verbatim: entry.ramadan.map(entry.tarawihLine) ?? entry.todayLine)
                .font(.caption2)
                .foregroundStyle(.secondary)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .dynamicTypeSize(...DynamicTypeSize.xLarge)
    }
}

struct QuranWidgetMediumView: View {
    let entry: QuranWidgetEntry

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            VStack(alignment: .leading, spacing: 6) {
                QuranWidgetSummary(entry: entry)
                Spacer(minLength: 0)
                WidgetProgressBar(fraction: entry.quran.fraction)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            VStack(alignment: .leading, spacing: 9) {
                if let ramadan = entry.ramadan {
                    if let night = ramadan.night {
                        QuranWidgetFigure(symbol: "moon.stars", text: SystemText.format("Night %@", entry.language, SystemText.number(night.number, entry.language)))
                        QuranWidgetFigure(symbol: ramadan.tarawih == nil ? "circle" : "checkmark.circle.fill", text: entry.tarawihLine(ramadan), isDone: ramadan.tarawih != nil)
                    }
                    if let line = entry.goalLine(ramadan) {
                        QuranWidgetFigure(symbol: "target", text: line, isDone: ramadan.pagesPerDay == 0)
                    }
                    QuranWidgetFigure(symbol: "book", text: entry.todayLine)
                } else {
                    QuranWidgetFigure(symbol: "square.stack", text: SystemText.format("Juz %@", entry.language, SystemText.number(entry.quran.juz, entry.language)))
                    QuranWidgetFigure(symbol: "book", text: entry.todayLine)
                    QuranWidgetFigure(symbol: "checkmark.seal", text: SystemText.format("Khatmahs: %@", entry.language, SystemText.number(entry.quran.khatmahs, entry.language)))
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
        .dynamicTypeSize(...DynamicTypeSize.large)
    }
}

// MARK: Lock Screen

struct QuranWidgetCircularView: View {
    let entry: QuranWidgetEntry

    var body: some View {
        Gauge(value: entry.quran.fraction) {
            Image(systemName: "book.pages")
        } currentValueLabel: {
            Text(verbatim: SystemText.number(entry.quran.nextPage, entry.language))
                .font(.system(size: 13, weight: .semibold))
                .minimumScaleFactor(0.6)
        }
        .gaugeStyle(.accessoryCircular)
        .widgetAccentable()
        .accessibilityLabel(Text(verbatim: entry.pageTitle))
    }
}

struct QuranWidgetRectangularView: View {
    let entry: QuranWidgetEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Label {
                Text(verbatim: entry.pageTitle)
            } icon: {
                Image(systemName: "book.pages")
            }
            .font(.headline)
            .widgetAccentable()
            Text(verbatim: entry.suraTitle)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .lineLimit(1)
            WidgetProgressBar(fraction: entry.quran.fraction)
                .padding(.top, 2)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }
}

struct QuranWidgetInlineView: View {
    let entry: QuranWidgetEntry

    var body: some View {
        Label {
            Text(verbatim: SystemText.format("%1$@ %2$@", entry.language, SystemText.string("Quran", entry.language), entry.pageTitle))
        } icon: {
            Image(systemName: "book.pages")
        }
    }
}

// MARK: Lines

private extension QuranWidgetEntry {
    var pageTitle: String { SystemText.format("Page %@", language, SystemText.number(quran.nextPage, language)) }

    /// The surah's name in the widget's language.
    var suraTitle: String { language.isArabic ? quran.suraName : quran.suraTransliteration }

    var todayLine: String { SystemText.format("Pages today: %@", language, SystemText.number(quran.pagesToday, language)) }

    func tarawihLine(_ ramadan: RamadanGlance) -> String {
        guard let record = ramadan.tarawih else {
            return SystemText.format("%1$@: %2$@", language, SystemText.string("Tarawih", language), SystemText.string("not logged yet", language))
        }
        switch record.place {
        case .masjid: return SystemText.format("%1$@: %2$@", language, SystemText.string("Tarawih", language), SystemText.string("at the masjid", language))
        case .home: return SystemText.format("%1$@: %2$@", language, SystemText.string("Tarawih", language), SystemText.string("at home", language))
        case nil: return SystemText.string("Tarawih", language)
        }
    }

    func goalLine(_ ramadan: RamadanGlance) -> String? {
        guard let pages = ramadan.pagesPerDay else { return nil }
        return pages == 0 ? SystemText.string("Goal met", language) : SystemText.format("Pages a day: %@", language, SystemText.number(pages, language))
    }
}
