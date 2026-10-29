import Foundation

/// A small dataset with every list the schema allows, standing in for the after-prayer, bedtime
/// and tasbih content until it lands in the bundled dataset. Its "Arabic" is placeholder text:
/// real recitation text only ever comes from the dataset itself.
enum DatasetFixture {
    static let json = Data("""
    {
      "version": 3,
      "sources": [{ "name": "Test", "url": "https://example.org", "license": "none", "usedFor": "tests" }],
      "items": {
        "kursi": {
          "id": "kursi", "arabic": "kursi-text", "translation": "Kursi", "repeat": 1,
          "reference": { "en": "Morning reference 1", "ar": "مرجع 1" },
          "virtue": { "en": "Morning virtue", "ar": "فضل" },
          "quran": [{ "surah": 2, "from": 255, "to": 255 }],
          "afterPrayer": {
            "narration": { "reference": { "en": "After-prayer reference 100", "ar": "مرجع 100" } },
            "someFutureField": true
          }
        },
        "tahlil-ten": {
          "id": "tahlil-ten", "arabic": "tahlil-text", "translation": "Tahlil", "repeat": 10,
          "reference": { "en": "Ref", "ar": "مرجع" },
          "afterPrayer": { "prayers": ["fajr", "maghrib", "sunrise"] }
        },
        "muawwidhat": {
          "id": "muawwidhat", "arabic": "muawwidhat-text", "translation": "The three", "repeat": 1,
          "reference": { "en": "Ref", "ar": "مرجع" },
          "afterPrayer": { "repeat": { "fajr": 3, "maghrib": 3, "noon": 9 } }
        },
        "subhanallah": {
          "id": "subhanallah", "arabic": "subhanallah-text one two three four five six seven", "transliteration": " Subḥānallāh ",
          "translation": "Glory be to Allah", "repeat": 33, "reference": { "en": "Muslim 597", "ar": "مسلم 597" },
          "note": { "en": "", "ar": "ملاحظة 33" }
        },
        "alhamdulillah": {
          "id": "alhamdulillah", "arabic": "alhamdulillah-text", "translation": "Praise be to Allah", "repeat": 33,
          "reference": { "en": "Muslim 597", "ar": "مسلم 597" }
        },
        "bedtime": {
          "id": "bedtime", "arabic": "bedtime-text", "translation": "Bedtime", "repeat": 1,
          "reference": { "en": "Bukhari 6320", "ar": "البخاري 6320" }
        }
      },
      "collections": { "morning": ["kursi", "subhanallah"], "evening": [], "sleep": ["bedtime"], "unknownSession": ["kursi"] },
      "afterPrayer": ["kursi", "tahlil-ten", "muawwidhat"],
      "tasbih": ["subhanallah", "alhamdulillah"]
    }
    """.utf8)
}
