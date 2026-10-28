import SwiftUI
import WidgetKit
import XCTest

/// Draws every widget, in both languages and both appearances, from the fixture. Run with
/// TEST_RUNNER_WIDGET_RENDER_DIR=/some/folder in the environment to save the pictures there.
@MainActor
final class WidgetRenderTests: XCTestCase {
    private static let sizes: [(WidgetFamily, String, CGSize)] = [
        (.systemSmall, "small", CGSize(width: 170, height: 170)),
        (.systemMedium, "medium", CGSize(width: 364, height: 170)),
        (.accessoryRectangular, "rectangular", CGSize(width: 172, height: 76)),
        (.accessoryCircular, "circular", CGSize(width: 76, height: 76)),
    ]

    private func render(_ entry: PrayerEntry, _ family: WidgetFamily, size: CGSize, scheme: ColorScheme) -> UIImage? {
        let system = family == .systemSmall || family == .systemMedium
        let view = WidgetView(entry: entry, family: family)
            .padding(system ? 16 : 0)
            .frame(width: size.width, height: size.height)
            .background(system ? Palette.background : Color.black)
            .environment(\.colorScheme, system ? scheme : .dark)
        let renderer = ImageRenderer(content: view)
        renderer.scale = 3
        return renderer.uiImage
    }

    private func save(_ image: UIImage, _ name: String) throws {
        guard let folder = ProcessInfo.processInfo.environment["WIDGET_RENDER_DIR"] else { return }
        let url = URL(fileURLWithPath: folder).appendingPathComponent("\(name).png")
        try XCTUnwrap(image.pngData()).write(to: url)
    }

    private func snapshot(lang: String, name: String) throws -> WidgetSnapshot {
        var snapshot = try Fixtures.snapshot()
        snapshot.name = name
        if lang == "en" {
            snapshot.lang = "en"
            snapshot.arabicDigits = false
            let english = try XCTUnwrap(Bundle.widget.path(forResource: "en", ofType: "lproj").flatMap(Bundle.init(path:)))
            for key in snapshot.labels.keys {
                snapshot.labels[key] = english.localizedString(forKey: key, value: nil, table: nil)
            }
            snapshot.labels["greeting"] = name.isEmpty ? "" : "As-salamu alaykum, \u{2068}\(name)\u{2069}"
            let times = ["5:28 AM", "12:43 PM", "3:59 PM", "6:28 PM", "7:45 PM"]
            for index in snapshot.days[0].prayers.indices { snapshot.days[0].prayers[index].time = times[index] }
            for index in snapshot.days[1].prayers.indices { snapshot.days[1].prayers[index].time = times[index] }
        } else if name.isEmpty {
            snapshot.labels["greeting"] = ""
        }
        return snapshot
    }

    func testDrawsEveryFamilyInBothLanguagesAndAppearances() throws {
        // 14:30 in Cairo: Asr is next, Fajr and Dhuhr are logged.
        let moment = Fixtures.utc("2026-10-12T11:30")
        for lang in ["en", "ar"] {
            let entry = PrayerEntry(date: moment, snapshot: try snapshot(lang: lang, name: lang == "en" ? "Ahmed" : "أحمد"))
            XCTAssertEqual(entry.content.isReady, true)
            for (family, familyName, size) in Self.sizes {
                for scheme in [ColorScheme.light, .dark] {
                    let image = try XCTUnwrap(render(entry, family, size: size, scheme: scheme))
                    XCTAssertEqual(image.size, size)
                    try save(image, "\(familyName)-\(lang)-\(scheme == .dark ? "dark" : "light")")
                }
            }
        }
    }

    func testDrawsTheMessagesAndTheNextDay() throws {
        let cases: [(String, PrayerEntry)] = [
            ("not-set-up", PrayerEntry(date: Date(), snapshot: nil)),
            ("stale-ar", PrayerEntry(date: Fixtures.utc("2026-10-14T12:00"), snapshot: try snapshot(lang: "ar", name: ""))),
            ("tomorrow-en", PrayerEntry(date: Fixtures.utc("2026-10-12T17:00"), snapshot: try snapshot(lang: "en", name: ""))),
        ]
        for (name, entry) in cases {
            for (family, familyName, size) in Self.sizes where family == .systemMedium || family == .accessoryRectangular {
                let image = try XCTUnwrap(render(entry, family, size: size, scheme: .light))
                try save(image, "\(name)-\(familyName)")
            }
        }
    }
}
