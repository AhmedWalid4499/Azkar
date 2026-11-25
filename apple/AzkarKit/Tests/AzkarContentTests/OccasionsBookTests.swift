import AzkarCore
import Foundation
import Testing
@testable import AzkarContent

/// The duas for occasions as `scripts/azkar/build-occasions.mjs` bundles them.
struct OccasionsBookTests {
    let book = OccasionsBook.bundled

    @Test func holdsEveryChapterOnce() {
        #expect(book.chapters.count == 123)
        #expect(book.items.count == 210)
        let numbers = book.chapters.map(\.number)
        #expect(Set(numbers).count == numbers.count)
        // The chapters read as daily sessions, and those with no words to say, are not here.
        for skipped in [25, 27, 28, 29, 131, 51, 108, 109, 132, 133] {
            #expect(book.chapter(skipped) == nil)
        }
        let inThemes = book.themes.flatMap(\.chapters)
        #expect(inThemes.sorted() == numbers.sorted())
        for chapter in book.chapters {
            #expect(book.themes.first { $0.chapters.contains(chapter.number) }?.id == chapter.theme)
        }
    }

    @Test func everyEntryIsComplete() {
        let ids = book.chapters.flatMap(\.items)
        #expect(Set(ids) == Set(book.items.keys))
        for chapter in book.chapters {
            #expect(!chapter.title.en.isEmpty && !chapter.title.ar.isEmpty)
            #expect(!chapter.items.isEmpty)
        }
        for dhikr in book.items.values {
            #expect(dhikr.id.hasPrefix(TasbihRecord.occasionPrefix))
            #expect(TasbihRecord.isOccasion(dhikr.id))
            #expect(!dhikr.arabic.isEmpty && !dhikr.translation.isEmpty && !dhikr.reference.en.isEmpty)
            if OccasionsBook.isRecited(dhikr) {
                #expect(!(dhikr.transliteration ?? "").isEmpty, "\(dhikr.id) is said but has no transliteration")
            } else {
                #expect(dhikr.repeat == 0)
                #expect(dhikr.transliteration == nil, "\(dhikr.id) is guidance but has a transliteration")
            }
        }
        #expect(book.items.values.filter(OccasionsBook.isRecited).count == 183)
    }

    /// A later edit of a single mark of the Arabic is noticed.
    @Test func arabicMatchesItsFingerprints() throws {
        let expected = try Fixtures.load([String: String].self, "occasion-fingerprints.json")
        #expect(expected.count == book.items.count)
        for (id, dhikr) in book.items {
            #expect(Self.fingerprint(dhikr.arabic) == expected[id], "\(id)")
        }
    }

    @Test func credits() {
        #expect(book.sources.count == 2)
        #expect(book.sources.allSatisfy { $0.url.hasPrefix("https://") && !$0.license.isEmpty })
    }

    @Test func searchesWithoutVowelMarks() throws {
        // The Arabic of the first word of a chapter, with its vowel marks taken off.
        let leaving = try #require(book.chapter(10))
        let first = try #require(book.entries(of: leaving).first)
        let bare = OccasionsBook.searchKey(String(first.arabic.split(separator: " ")[0]))
        #expect(bare.unicodeScalars.allSatisfy { !(0x064B...0x065F).contains($0.value) })
        #expect(!book.search(bare).isEmpty)
        #expect(book.search("leaving home").contains { $0.number == 10 })
        #expect(book.search("RAIN").contains { $0.theme == "nature" })
        #expect(book.search("   ").isEmpty)
    }

    /// FNV-1a over UTF-16 code units, as `fingerprint()` in scripts/azkar/lib/arabic.mjs.
    static func fingerprint(_ text: String) -> String {
        var hash: UInt32 = 0x811C_9DC5
        for unit in text.utf16 {
            hash ^= UInt32(unit)
            hash = hash &* 0x0100_0193
        }
        let hex = String(hash, radix: 16)
        return String(repeating: "0", count: 8 - hex.count) + hex
    }
}
