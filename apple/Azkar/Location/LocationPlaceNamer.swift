import AzkarKit
import CoreLocation
import Foundation
import MapKit

/// Names places and finds cities with Apple Maps: reverse geocoding for a fix, local search for
/// what the user types. Each place comes with its IANA zone and ISO country code, which the prayer
/// times need, and a label in the interface language.
enum LocationPlaceNamer {
    struct Named: Hashable {
        var label: String
        var countryCode: String?
        var timeZone: String?
    }

    /// Searches shorter than this find nothing useful.
    static let minimumQueryLength = 2
    /// Reverse geocoding gives up after this long (offline it may never answer).
    static let namingTimeout: Duration = .seconds(10)
    /// The most places one search offers.
    static let maximumResults = 6

    /// The language the user reads the app in: the in-app choice, else the app's own language on this iPhone.
    static func interfaceLocale() -> Locale {
        switch SettingsStore.shared().load().app.language {
        case .en: Locale(identifier: "en")
        case .ar: Locale(identifier: "ar")
        case .system: Locale(identifier: Bundle.main.preferredLocalizations.first ?? "en")
        }
    }

    // MARK: Reverse geocoding

    /// The place at a fix. Only a position rounded to two decimals (about a kilometre) is sent.
    static func name(latitude: Double, longitude: Double, locale: Locale) async -> Named? {
        let approximate = CLLocation(
            latitude: LocationService.rounded(latitude, places: 2),
            longitude: LocationService.rounded(longitude, places: 2)
        )
        guard let request = MKReverseGeocodingRequest(location: approximate) else { return nil }
        request.preferredLocale = locale
        let timer = Task {
            try? await Task.sleep(for: namingTimeout)
            if !Task.isCancelled { request.cancel() }
        }
        defer { timer.cancel() }
        guard let item = try? await request.mapItems.first else { return nil }
        return named(item, locale: locale)
    }

    /// "Cairo, Egypt": the city (or the item's own name) and the country in the interface language.
    static func named(_ item: MKMapItem, locale: Locale) -> Named {
        let address = item.addressRepresentations
        let code = address?.region?.identifier.uppercased()
        let country = code.flatMap { locale.localizedString(forRegionCode: $0) } ?? address?.regionName
        let city = address?.cityName ?? item.name
        var parts: [String] = []
        if let city, !city.isEmpty { parts.append(city) }
        if let country, !country.isEmpty, !parts.contains(country) { parts.append(country) }
        let separator = locale.language.languageCode == .arabic ? "، " : ", "
        return Named(label: parts.joined(separator: separator), countryCode: code, timeZone: item.timeZone?.identifier)
    }

    // MARK: City search

    private static let completer = LocationCompleter()

    /// Towns matching the text: Apple Maps' suggestions, each looked up for its position and zone.
    static func search(_ query: String, locale: Locale, now: Double) async throws -> [SavedLocation] {
        let text = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard text.count >= minimumQueryLength else { return [] }
        let suggestions = try await completer.suggestions(for: text)
        guard !Task.isCancelled else { return [] }
        let items = await resolve(Array(suggestions.prefix(maximumResults)))
        var places: [SavedLocation] = []
        var seen: Set<String> = []
        for item in items.compactMap({ $0 }) {
            var named = named(item, locale: locale)
            // "Springfield, IL, United States": enough to tell places of one name apart.
            if let context = item.addressRepresentations?.cityWithContext(.full), !context.isEmpty {
                named.label = withoutRepeats(context)
            }
            guard !named.label.isEmpty, let zone = await zone(of: item, named: named, locale: locale) else { continue }
            let coordinate = item.location.coordinate
            let latitude = LocationService.rounded(coordinate.latitude, places: 4)
            let longitude = LocationService.rounded(coordinate.longitude, places: 4)
            guard seen.insert(named.label).inserted else { continue }
            places.append(SavedLocation(
                latitude: latitude, longitude: longitude, timeZone: zone, label: named.label,
                countryCode: named.countryCode, source: .manual, updatedAt: now
            ))
        }
        if places.isEmpty, !suggestions.isEmpty, items.allSatisfy({ $0 == nil }) {
            throw LocationService.Failure.unavailable
        }
        return places
    }

    /// "Alexandria, Alexandria, Egypt" (a city in a province of its name) as "Alexandria, Egypt".
    static func withoutRepeats(_ label: String) -> String {
        for separator in [", ", "، "] where label.contains(separator) {
            var parts: [Substring] = []
            for part in label.split(separator: separator) where part != parts.last { parts.append(part) }
            return parts.joined(separator: separator)
        }
        return label
    }

    /// Each suggestion's place, looked up side by side; `nil` where the lookup failed.
    private static func resolve(_ suggestions: [MKLocalSearchCompletion]) async -> [MKMapItem?] {
        guard !suggestions.isEmpty else { return [] }
        let found = FoundItems(count: suggestions.count)
        await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
            var remaining = suggestions.count
            for (index, suggestion) in suggestions.enumerated() {
                MKLocalSearch(request: MKLocalSearch.Request(completion: suggestion)).start { response, _ in
                    found.items[index] = response?.mapItems.first
                    remaining -= 1
                    if remaining == 0 { continuation.resume() }
                }
            }
        }
        return found.items
    }

    /// Where the side-by-side lookups leave their answers.
    private final class FoundItems {
        var items: [MKMapItem?]
        init(count: Int) { items = Array(repeating: nil, count: count) }
    }

    /// The item's zone; when the search result lacks one, the reverse-geocoded place's.
    private static func zone(of item: MKMapItem, named: Named, locale: Locale) async -> String? {
        if let zone = named.timeZone { return zone }
        let coordinate = item.location.coordinate
        return await name(latitude: coordinate.latitude, longitude: coordinate.longitude, locale: locale)?.timeZone
    }
}
