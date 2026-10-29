import Foundation
import MapKit

/// Apple Maps' suggestions for what the user is typing, limited to towns and regions, as async calls.
/// One question at a time: a new one answers the previous with an empty list.
@MainActor
final class LocationCompleter: NSObject, MKLocalSearchCompleterDelegate {
    private let completer = MKLocalSearchCompleter()
    /// Resumed with whether the completer's results answer the question (false: nothing found).
    private var waiter: CheckedContinuation<Bool, any Error>?
    private var deadline: Task<Void, Never>?

    /// Apple Maps gives up after this long without an answer (offline it may never answer).
    static let timeout: Duration = .seconds(10)

    override init() {
        super.init()
        completer.delegate = self
        completer.resultTypes = .address
        completer.addressFilter = MKAddressFilter(including: [.locality, .subAdministrativeArea, .administrativeArea])
    }

    func suggestions(for text: String) async throws -> [MKLocalSearchCompletion] {
        finish(.success(false))
        if completer.queryFragment == text, !completer.isSearching {
            return completer.results
        }
        let found = try await withCheckedThrowingContinuation { continuation in
            waiter = continuation
            completer.queryFragment = text
            deadline = Task { [weak self] in
                try? await Task.sleep(for: Self.timeout)
                guard !Task.isCancelled else { return }
                self?.finish(.failure(LocationService.Failure.unavailable))
            }
        }
        return found ? completer.results : []
    }

    private func finish(_ result: Result<Bool, any Error>) {
        deadline?.cancel()
        deadline = nil
        waiter?.resume(with: result)
        waiter = nil
    }

    nonisolated func completerDidUpdateResults(_ completer: MKLocalSearchCompleter) {
        MainActor.assumeIsolated { finish(.success(true)) }
    }

    nonisolated func completer(_ completer: MKLocalSearchCompleter, didFailWithError error: any Error) {
        let notFound = (error as? MKError)?.code == .placemarkNotFound
        MainActor.assumeIsolated {
            finish(notFound ? .success(false) : .failure(LocationService.Failure.unavailable))
        }
    }
}
