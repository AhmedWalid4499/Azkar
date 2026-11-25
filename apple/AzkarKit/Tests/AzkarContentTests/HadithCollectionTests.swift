import AzkarCore
import CryptoKit
import Foundation
import Testing
@testable import AzkarContent

@Suite("Riyad as-Salihin")
struct HadithCollectionTests {
    private let collection = HadithCollection.bundled

    @Test("All 1,896 hadith, numbered 1 to 1896 with no gaps, in 20 books")
    func counts() {
        #expect(collection.hadith.count == 1896)
        #expect(collection.hadith.map(\.number) == Array(1...1896))
        #expect(collection.books.count == 20)
        #expect(collection.books.map(\.number) == Array(0...19))
        #expect(collection.books.reduce(0) { $0 + $1.count } == 1896)
        for book in collection.books {
            let items = collection.hadith(inBook: book.number)
            #expect(items.count == book.count, "book \(book.number)")
            #expect(items.map(\.inBook) == Array(1...book.count), "book \(book.number)")
            #expect(!book.title.isEmpty && !book.english.isEmpty)
        }
        #expect(collection.book(0)?.count == 679)
        #expect(collection.hadith.allSatisfy { !$0.text.isEmpty })
        #expect(collection.sources.count == 2)
    }

    /// Each hadith's text and source note exactly as `scripts/hadith/build.mjs` copied them: a
    /// changed mark anywhere changes a fingerprint.
    @Test("Every hadith matches its fingerprint")
    func fingerprints() throws {
        let url = Fixtures.repo.appending(path: "scripts/hadith/fixtures/riyad-fingerprints.json")
        let expected = try JSONDecoder().decode([String: String].self, from: Data(contentsOf: url))
        #expect(expected.count == 1896)
        for item in collection.hadith {
            let digest = SHA256.hash(data: Data((item.text + "\u{0}" + (item.source ?? "")).utf8))
            let print = digest.map { String(format: "%02x", $0) }.joined().prefix(16)
            #expect(String(print) == expected[String(item.number)], "hadith \(item.number)")
        }
    }

    @Test("The search ignores vowel marks, tatweel and the ways of writing hamza and alif")
    func normalising() {
        let hamzaAlif = "\u{0623}\u{064E}\u{0645}\u{0652}\u{0640}\u{0631}"
        #expect(HadithCollection.normalised(hamzaAlif) == "\u{0627}\u{0645}\u{0631}")
        #expect(HadithCollection.normalised("\u{0625}\u{0622}\u{0671}") == "\u{0627}\u{0627}\u{0627}")
        #expect(HadithCollection.normalised("\u{0624}\u{0626}\u{0649}\u{0629}") == "\u{0648}\u{064A}\u{064A}\u{0647}")
        #expect(HadithCollection.normalised("  a,  B:\u{060C}c  ") == "a b c")
        #expect(HadithCollection.normalised("\u{0661}\u{0662}") == "12")
    }

    @Test("Typing without vowel marks finds a vowelled hadith")
    func unvowelledSearch() throws {
        let vowelled = try #require(collection.hadith.first { item in
            item.text.unicodeScalars.contains { (0x064B...0x0652).contains($0.value) }
        })
        // The longest vowelled word of it, typed bare.
        let words = vowelled.text.split(separator: " ").map(String.init)
        let word = try #require(words.filter { $0.unicodeScalars.contains { (0x064B...0x0652).contains($0.value) } }.max { $0.count < $1.count })
        let bare = String(String.UnicodeScalarView(word.unicodeScalars.filter { !(0x064B...0x0652).contains($0.value) }))
        #expect(bare != word)
        let results = collection.search(bare)
        #expect(results.contains { $0.number == vowelled.number })
        // Two words must both be there.
        let other = try #require(words.first { HadithCollection.normalised($0).count > 3 && $0 != word })
        #expect(collection.search(bare + " " + other).allSatisfy { HadithCollection.normalised($0.text).contains(HadithCollection.normalised(other)) })
    }

    @Test("A number finds its hadith first, in any digits")
    func numberSearch() {
        #expect(collection.search("1268").first?.number == 1268)
        #expect(collection.search("\u{0661}\u{0662}\u{0666}\u{0668}").first?.number == 1268)
        #expect(collection.search("1268").first?.book == 9)
        #expect(collection.search("99999").isEmpty)
        #expect(collection.search("   ").isEmpty)
    }

    @Test("The hadith of the day holds all day, changes daily, and is a short one")
    func ofTheDay() throws {
        let day = try #require(DayKey("2026-11-16"))
        let first = collection.ofTheDay(day)
        #expect(collection.ofTheDay(try #require(DayKey("2026-11-16"))) == first)
        #expect(first.text.count <= HadithCollection.dailyLength)
        var seen: Set<Int> = []
        for offset in 0..<365 {
            let item = collection.ofTheDay(day.adding(days: offset))
            #expect(item.text.count <= HadithCollection.dailyLength)
            seen.insert(item.number)
        }
        #expect(seen.count == 365, "no hadith comes back within a year")
        #expect(HadithCollection.dayNumber(try #require(DayKey("1970-01-01"))) == 0)
        #expect(HadithCollection.dayNumber(try #require(DayKey("2000-03-01"))) == 11017)
    }
}
