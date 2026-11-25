import AzkarCore
import Foundation

/// The bundled azkar dataset: a byte-identical copy of `src/features/azkar/data/azkar.json`,
/// the single source of truth shared with the website. Never edit the copy; rebuild the
/// web dataset with `scripts/azkar` and copy it over (a test guards that they match).
public enum AzkarResources {
    public static var datasetURL: URL {
        guard let url = Bundle.module.url(forResource: "azkar", withExtension: "json") else {
            preconditionFailure("azkar.json is missing from the AzkarKit bundle")
        }
        return url
    }

    /// The duas for occasions, built for the native app only by `scripts/azkar/build-occasions.mjs`.
    public static var occasionsURL: URL {
        guard let url = Bundle.module.url(forResource: "occasions", withExtension: "json") else {
            preconditionFailure("occasions.json is missing from the AzkarKit bundle")
        }
        return url
    }
}
