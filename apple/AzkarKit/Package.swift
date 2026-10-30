// swift-tools-version: 6.2
import PackageDescription

// Everything that is not a screen, shared by the app, its widgets and its App Intents,
// and testable on the Mac with `swift test` in seconds. One module per area so each can
// be built and tested on its own:
//   AzkarCore     shared types (prayers, calendar days, settings, record values)
//   PrayerEngine  prayer times, schedules and the Qibla, on top of Adhan
//   AzkarContent  the azkar dataset, the Hijri calendar, fasting days and statistics
//   AzkarStore    the user's records and settings on the device, imports and backups
//   AzkarKit      re-exports all four
let package = Package(
    name: "AzkarKit",
    defaultLocalization: "en",
    platforms: [.iOS("27.0"), .macOS("27.0"), .watchOS("11.0")],
    products: [
        .library(name: "AzkarKit", targets: ["AzkarKit"]),
        // The Watch app needs only the shared types: the records stay on the iPhone.
        .library(name: "AzkarCore", targets: ["AzkarCore"]),
    ],
    dependencies: [
        .package(url: "https://github.com/batoulapps/adhan-swift", exact: "1.5.0"),
    ],
    targets: [
        .target(name: "AzkarCore"),
        .target(name: "PrayerEngine", dependencies: ["AzkarCore", .product(name: "Adhan", package: "adhan-swift")]),
        .target(name: "AzkarContent", dependencies: ["AzkarCore"], resources: [.copy("Resources/azkar.json"), .copy("Resources/quran-uthmani.txt"), .copy("Resources/quran-data.xml")]),
        .target(name: "AzkarStore", dependencies: ["AzkarCore"]),
        .target(name: "AzkarKit", dependencies: ["AzkarCore", "PrayerEngine", "AzkarContent", "AzkarStore"]),
        .testTarget(name: "AzkarCoreTests", dependencies: ["AzkarCore"]),
        .testTarget(name: "PrayerEngineTests", dependencies: ["PrayerEngine", .product(name: "Adhan", package: "adhan-swift")], exclude: ["Fixtures"]),
        .testTarget(name: "AzkarContentTests", dependencies: ["AzkarContent", .product(name: "Adhan", package: "adhan-swift")]),
        .testTarget(name: "AzkarStoreTests", dependencies: ["AzkarStore"]),
    ]
)
