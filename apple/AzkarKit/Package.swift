// swift-tools-version: 6.2
import PackageDescription

// Everything that is not a screen: the prayer-time engine, the azkar dataset, the
// user's records and the statistics over them. Shared by the app, its widgets and
// its App Intents, and testable on the Mac with `swift test` in seconds.
let package = Package(
    name: "AzkarKit",
    defaultLocalization: "en",
    platforms: [.iOS("27.0"), .macOS("27.0")],
    products: [
        .library(name: "AzkarKit", targets: ["AzkarKit"]),
    ],
    dependencies: [
        .package(url: "https://github.com/batoulapps/adhan-swift", exact: "1.5.0"),
    ],
    targets: [
        .target(
            name: "AzkarKit",
            dependencies: [.product(name: "Adhan", package: "adhan-swift")],
            resources: [.copy("Resources/azkar.json")]
        ),
        .testTarget(
            name: "AzkarKitTests",
            dependencies: ["AzkarKit"]
        ),
    ]
)
