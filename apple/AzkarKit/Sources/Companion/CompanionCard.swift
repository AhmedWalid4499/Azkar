import AzkarContent
import Foundation

/// Verified text the companion asked the app to show, under its reply.
public enum CompanionCard: Hashable, Sendable {
    /// Consecutive ayat of one surah, from the app's copy of the Quran.
    case quran(sura: Int, from: Int, to: Int, ayat: [QuranAyah])
    /// A dua of `ComfortDuas`, with the topic it belongs to.
    case dua(ComfortDuas.Dua, topic: ComfortDuas.Topic)
}
