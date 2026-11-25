import AzkarCore
import Foundation

/// A tafsir with one explanation for each ayah, kept exactly as its publisher gives it.
///
/// The bundled one is al-Mukhtasar fi Tafsir al-Qur'an al-Karim (Arabic), by the Tafsir Center for
/// Qur'anic Studies, from QuranEnc.com (`scripts/quran/fetch-tafsir.mjs`). QuranEnc allows
/// republishing it unchanged, with credit to the publisher and to QuranEnc.com.
public final class QuranTafsir: Sendable {
    /// Its Arabic title.
    public let title: String
    public let publisher: String
    /// Where it was taken from.
    public let source: URL
    /// The day it was downloaded, which stands for its version (QuranEnc publishes none for it).
    public let retrieved: String
    /// One explanation per ayah, in mushaf order.
    private let ayat: [String]

    public struct Malformed: Error, Hashable, CustomStringConvertible {
        public var description: String
    }

    private struct Raw: Decodable {
        var title: String
        var publisher: String
        var source: URL
        var retrieved: String
        var ayat: [String]
    }

    public init(json: Data) throws {
        let raw = try JSONDecoder().decode(Raw.self, from: json)
        guard raw.ayat.count == QuranLayout.ayahTotal else { throw Malformed(description: "\(raw.ayat.count) ayat") }
        title = raw.title
        publisher = raw.publisher
        source = raw.source
        retrieved = raw.retrieved
        ayat = raw.ayat
    }

    /// Al-Mukhtasar, read on first use. Decoding takes a moment: touch it away from the main actor first.
    public static let mukhtasar: QuranTafsir = {
        do {
            return try QuranTafsir(json: Data(contentsOf: QuranResources.mukhtasarURL))
        } catch {
            preconditionFailure("The bundled tafsir could not be read: \(error)")
        }
    }()

    /// The explanation of an ayah.
    public func text(for ref: AyahRef) -> String? {
        QuranLayout.contains(ref) ? ayat[QuranLayout.index(ref)] : nil
    }
}
