import AzkarCore
import CryptoKit
import Foundation
import Testing
@testable import AzkarContent

@Suite("Searching the Qur'an")
struct QuranSearchTests {
    private let search = QuranSearch.bundled

    private func hash(_ url: URL) throws -> String {
        SHA256.hash(data: try Data(contentsOf: url)).map { String(format: "%02x", $0) }.joined()
    }

    private func highlighted(_ hit: QuranSearchHit) -> [String] {
        hit.segments.filter(\.isMatch).map(\.text)
    }

    /// Only Tanzil's own Simple Clean file, as downloaded. A changed hash must be investigated.
    @Test("The search text is the one checked against tanzil.net, notice kept")
    func pinned() throws {
        #expect(try hash(QuranResources.searchTextURL) == "228df2a717671aeb9d2ff573002bd28d6b3f973f4bc7153554e3a81663d67610")
        let text = try String(contentsOf: QuranResources.searchTextURL, encoding: .utf8)
        #expect(text.contains("Tanzil Quran Text (Simple Clean, Version 1.1)"))
        #expect(text.contains("CHANGING IT IS NOT ALLOWED"))
    }

    @Test("A word typed in everyday spelling finds its Uthmani spelling, highlighted")
    func everydaySpelling() throws {
        let results = search.search("الصلاة")
        #expect(results.hits.count > 60)
        let first = try #require(results.hits.first)
        #expect(first.ref == AyahRef(sura: 2, ayah: 3))
        #expect(highlighted(first) == ["ٱلصَّلَوٰةَ"])
        #expect(first.page == 2)
    }

    @Test("Hamza, ta marbuta and vowel marks typed or not make no difference")
    func folding() {
        #expect(search.search("الصلاه").hits.count == search.search("الصَّلاة").hits.count)
        #expect(search.search("ايمان").hits.map(\.id) == search.search("إيمان").hits.map(\.id))
    }

    @Test("Every occurrence is counted, and a whole word leaves out longer words")
    func occurrences() {
        let anywhere = search.search("قال")
        let whole = search.search("قال", mode: .wholeWord)
        #expect(anywhere.occurrences > whole.occurrences)
        #expect(whole.occurrences == 416)
        #expect(anywhere.hits.allSatisfy { $0.occurrences >= 1 })
        #expect(anywhere.occurrences == anywhere.hits.map(\.occurrences).reduce(0, +))
    }

    @Test("A phrase is found as a phrase, all its words highlighted")
    func phrase() throws {
        let results = search.search("الحمد لله رب العالمين")
        #expect(results.hits.map(\.ref).contains(AyahRef(sura: 1, ayah: 2)))
        let fatiha = try #require(results.hits.first { $0.ref == AyahRef(sura: 1, ayah: 2) })
        #expect(highlighted(fatiha) == ["ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ"])
    }

    @Test("The basmala in front of a first ayah is not searched or shown")
    func basmala() throws {
        let results = search.search("بسم الله الرحمن الرحيم")
        #expect(results.hits.map(\.ref) == [AyahRef(sura: 1, ayah: 1), AyahRef(sura: 27, ayah: 30)])
        let baqara = try #require(search.search("ذلك الكتاب").hits.first)
        #expect(baqara.ref == AyahRef(sura: 2, ayah: 2))
        let alif = try #require(search.search("2:1").reference)
        #expect(alif.segments.map(\.text).joined() == "الٓمٓ")
    }

    @Test("The vocative joined to its word is highlighted as that word")
    func vocative() throws {
        let hit = try #require(search.search("يا أيها الناس").hits.first)
        #expect(hit.ref == AyahRef(sura: 2, ayah: 21))
        #expect(highlighted(hit) == ["يَٰٓأَيُّهَا ٱلنَّاسُ"])
        let adam = try #require(search.search("آدم", mode: .wholeWord).hits.first { $0.ref == AyahRef(sura: 2, ayah: 33) })
        #expect(highlighted(adam) == ["يَٰٓـَٔادَمُ"])
    }

    @Test("Simple Clean and Uthmani words line up in all but two ayat")
    func alignment() throws {
        let mushaf = QuranMushaf.bundled
        let text = try String(contentsOf: QuranResources.searchTextURL, encoding: .utf8)
        var unaligned: [AyahRef] = []
        var index = 0
        for line in text.split(separator: "\n") where !line.hasPrefix("#") {
            let parts = line.split(separator: "|", maxSplits: 2)
            guard parts.count == 3 else { continue }
            let ayah = mushaf.ayat[index]
            index += 1
            let display = QuranTypesetting.displayText(ayah.text).split(separator: " ").map(String.init)
                .filter { $0.unicodeScalars.contains { $0.properties.isAlphabetic && !ArabicSearch.isIgnored($0.value) } }
            if QuranSearch.align(clean: parts[2].split(separator: " ").map(String.init), display: display) == nil {
                unaligned.append(AyahRef(sura: ayah.sura, ayah: ayah.number))
            }
        }
        #expect(unaligned == [AyahRef(sura: 20, ayah: 94), AyahRef(sura: 72, ayah: 16)])
    }

    @Test("Surahs by number, Arabic name, Latin letters or English meaning")
    func suras() {
        #expect(search.search("18").suras.map(\.number) == [18])
        #expect(search.search("الكهف").suras.map(\.number) == [18])
        #expect(search.search("سورة البقرة").suras.map(\.number) == [2])
        #expect(search.search("سورة البقرة").hits.isEmpty)
        #expect(search.search("بقره").suras.map(\.number) == [2])
        #expect(search.search("fatiha").suras.map(\.number) == [1])
        #expect(search.search("Al-Kahf").suras.map(\.number) == [18])
        #expect(search.search("imran").suras.map(\.number) == [3])
        #expect(search.search("the cow").suras.map(\.number) == [2])
        #expect(search.search("115").suras.isEmpty)
    }

    @Test("A reference opens its ayah, in any digits")
    func reference() {
        #expect(search.search("2:255").reference?.ref == AyahRef(sura: 2, ayah: 255))
        #expect(search.search("٢:٢٥٥").reference?.page == 42)
        #expect(search.search("1 7").reference?.ref == AyahRef(sura: 1, ayah: 7))
        #expect(search.search("1:8").reference == nil)
    }

    @Test("Nothing typed, nothing found")
    func empty() {
        #expect(search.search("  ").isEmpty)
        #expect(search.search("zzzz").isEmpty)
    }
}

@Suite("Arabic search")
struct ArabicSearchTests {
    @Test("Matches are traced back to the original text with their vowel marks")
    func segments() {
        let text = "قَالَ رَسُولُ اللَّهِ ﷺ: إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ"
        let segments = ArabicSearch.segments(of: text, matching: ArabicSearch.terms("الاعمال"))
        #expect(segments.map(\.text).joined() == text)
        #expect(segments.filter(\.isMatch).map(\.text) == ["الأَعْمَالُ"])
    }

    @Test("A match deep in a long text starts shortly before it")
    func lead() {
        let text = String(repeating: "كلمة ", count: 60) + "الصبر"
        let segments = ArabicSearch.segments(of: text, matching: ["الصبر"], lead: 80)
        #expect(segments.first?.text == "… ")
        #expect(segments.last?.isMatch == true)
        #expect(segments.map(\.text).joined().count < 70)
    }

    @Test("Counting, whole words and several words")
    func counting() {
        #expect(ArabicSearch.count(of: ["قال"], in: "قال فقال قالوا") == 3)
        #expect(ArabicSearch.count(of: ["قال"], in: "قال فقال قالوا", wholeWords: true) == 1)
        #expect(ArabicSearch.count(of: ["صبر", "صلاه"], in: "الصبر والصلاة") == 2)
    }
}

@Suite("The tafsir")
struct QuranTafsirTests {
    private let tafsir = QuranTafsir.mukhtasar

    private func hash(_ url: URL) throws -> String {
        SHA256.hash(data: try Data(contentsOf: url)).map { String(format: "%02x", $0) }.joined()
    }

    /// QuranEnc's text, unchanged. A changed hash must be investigated.
    @Test("Al-Mukhtasar is the file taken from QuranEnc")
    func pinned() throws {
        #expect(try hash(QuranResources.mukhtasarURL) == "6d723106b854e990fb5f6b44976c2dd762ee758e4469aff5dcca4f73b424181c")
        #expect(tafsir.title == "المختصر في تفسير القرآن الكريم")
        #expect(tafsir.source.host() == "quranenc.com")
    }

    @Test("Every ayah has its explanation, in mushaf order")
    func lookup() {
        #expect(tafsir.text(for: AyahRef(sura: 114, ayah: 1)) == "قل - أيها الرسول -: أعتصم برب الناس، وأستجير به.")
        #expect(tafsir.text(for: AyahRef(sura: 1, ayah: 3)) == "ثناء على الله تعالى بعد حمده في الآية السابقة.")
        for index in 0..<QuranLayout.ayahTotal {
            #expect(tafsir.text(for: QuranLayout.ref(at: index))?.isEmpty == false)
        }
        #expect(tafsir.text(for: AyahRef(sura: 1, ayah: 8)) == nil)
        #expect(tafsir.text(for: AyahRef(sura: 115, ayah: 1)) == nil)
        #expect(tafsir.text(for: AyahRef(sura: 0, ayah: 1)) == nil)
    }
}
