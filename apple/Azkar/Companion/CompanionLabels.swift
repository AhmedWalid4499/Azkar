import Foundation

/// A string of the companion's table.
nonisolated func CL(_ value: String.LocalizationValue) -> LocalizedStringResource {
    LocalizedStringResource(value, table: "Companion")
}
