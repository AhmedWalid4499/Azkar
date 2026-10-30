import CryptoKit
import Foundation
import Testing
@testable import AzkarContent

@Suite("The Qur'an")
struct QuranMushafTests {
    private let mushaf = QuranMushaf.bundled

    private func hash(_ url: URL) throws -> String {
        SHA256.hash(data: try Data(contentsOf: url)).map { String(format: "%02x", $0) }.joined()
    }

    /// The text may only ever be Tanzil's own files. A changed hash must be investigated.
    @Test("The bundled files are the ones checked against tanzil.net")
    func pinned() throws {
        #expect(try hash(QuranResources.textURL) == "4b91f9e6e8ac645d039e4ed85b3be492e795232a31cd22d668ac58238722e26f")
        #expect(try hash(QuranResources.metadataURL) == "8867c1d88191472adec9db694b3cd9f135b1a2ef580574d32cf888dcb22c5c7a")
    }

    @Test("The bundled text keeps Tanzil's notice")
    func notice() throws {
        let text = try String(contentsOf: QuranResources.textURL, encoding: .utf8)
        #expect(text.contains("Tanzil Quran Text (Uthmani, Version 1.1)"))
        #expect(text.contains("CHANGING IT IS NOT ALLOWED"))
    }

    @Test("Everything is there")
    func counts() {
        #expect(mushaf.ayat.count == 6236)
        #expect(mushaf.suras.count == 114)
        #expect(mushaf.juz.count == 30)
        #expect(mushaf.suras.map(\.ayahCount).reduce(0, +) == 6236)
        for sura in mushaf.suras {
            #expect(mushaf.ayat.filter { $0.sura == sura.number }.count == sura.ayahCount)
        }
    }

    @Test("Every ayah is on exactly one page, in order")
    func paging() {
        let paged = QuranMushaf.pages.flatMap { Array(mushaf.ayat(onPage: $0)) }
        #expect(paged == mushaf.ayat)
    }

    /// Known places in the Medina Mushaf.
    @Test("Surahs and juz begin on their mushaf pages", arguments: [
        (1, 1), (2, 2), (3, 50), (18, 293), (36, 440), (55, 531), (67, 562), (78, 582), (112, 604), (114, 604),
    ])
    func suraPages(sura: Int, page: Int) {
        #expect(mushaf.suras[sura - 1].page == page)
    }

    @Test("Juz begin on their mushaf pages", arguments: [(1, 1), (2, 22), (3, 42), (15, 282), (30, 582)])
    func juzPages(juz: Int, page: Int) {
        #expect(mushaf.juz[juz - 1].page == page)
        #expect(mushaf.juz(ofPage: page).number == juz)
        #expect(mushaf.juz(ofPage: 604).number == 30)
    }

    @Test("A page knows its surah")
    func suraOfPage() {
        #expect(mushaf.sura(ofPage: 1).number == 1)
        #expect(mushaf.sura(ofPage: 49).number == 2)
        #expect(mushaf.sura(ofPage: 604).number == 112)
    }

    @Test("Page 604 holds the last three surahs")
    func lastPage() {
        let headers = mushaf.content(ofPage: 604).compactMap { block -> Int? in
            if case let .suraHeader(sura) = block { return sura.number }
            return nil
        }
        #expect(headers == [112, 113, 114])
    }

    @Test("Laying out the pages loses nothing")
    func reassembly() {
        var rebuilt: [String] = []
        for page in QuranMushaf.pages {
            var basmala: String?
            for block in mushaf.content(ofPage: page) {
                switch block {
                case .suraHeader:
                    break
                case let .basmala(text):
                    basmala = text
                case let .ayat(ayat):
                    for ayah in ayat {
                        rebuilt.append([basmala, ayah.text].compactMap(\.self).joined(separator: " "))
                        basmala = nil
                    }
                }
            }
        }
        #expect(rebuilt == mushaf.ayat.map(\.text))
    }

    @Test("Every surah but Al-Fatiha and At-Tawba opens with a basmala on its own line")
    func basmala() {
        for ayah in mushaf.ayat where ayah.number == 1 {
            let parts = QuranMushaf.splitBasmala(ayah)
            if ayah.sura == 1 || ayah.sura == 9 {
                #expect(parts == nil)
            } else {
                #expect(parts?.basmala.hasSuffix("ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ") == true, "surah \(ayah.sura)")
            }
        }
    }

    @Test("Display only moves the pause marks onto their words")
    func display() {
        for ayah in mushaf.ayat {
            let shown = QuranTypesetting.displayText(ayah.text)
            #expect(shown.unicodeScalars.filter { $0 != " " }.elementsEqual(ayah.text.unicodeScalars.filter { $0 != " " }))
        }
        #expect(QuranTypesetting.displayText("كَلِمَة ۖ كَلِمَة") == "كَلِمَةۖ كَلِمَة")
    }

    @Test("Ayah numbers are written in Arabic-Indic digits")
    func ayahEnd() {
        #expect(QuranTypesetting.ayahEnd(286) == "\u{00A0}\u{06DD}٢٨٦")
    }
}
