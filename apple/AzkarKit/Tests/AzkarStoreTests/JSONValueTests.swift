import Foundation
import Testing
@testable import AzkarStore

/// Stored JSON is read as `JSON.parse` reads it, so the website's type checks mean the same here.
@Suite struct JSONValueTests {
    @Test func numbersAreNeverBooleansNorBooleansNumbers() {
        #expect(JSONValue(parsing: "1") == .number(1))
        #expect(JSONValue(parsing: "0") == .number(0))
        #expect(JSONValue(parsing: "true") == .bool(true))
        #expect(JSONValue(parsing: #"{"a":[1,"1",null,false]}"#) == ["a": [1, "1", nil, false]])
    }

    @Test func textThatIsNotJSONIsNothing() {
        #expect(JSONValue(parsing: "{not json") == nil)
        #expect(StoredEntry("{not json") == .unreadable)
        #expect(StoredEntry(nil) == .missing)
    }

    @Test func wholeNumbersAreWrittenAsIntegersAndFractionsKept() {
        #expect(JSONValue.number(1_788_207_000_000).text == "1788207000000")
        #expect(JSONValue.number(-0.0).text == "0")
        #expect(JSONValue.number(2.5).text == "2.5")
        #expect((["b": 1, "a": "x/y"] as JSONValue).text == #"{"a":"x/y","b":1}"#)
    }

    @Test func javascriptTruthinessDecidesWhetherAStoredValueCounts() {
        #expect(!JSONValue.null.isTruthy && !JSONValue.number(0).isTruthy && !JSONValue.string("").isTruthy && !JSONValue.bool(false).isTruthy)
        #expect(JSONValue.number(5).isTruthy && JSONValue.array([]).isTruthy && JSONValue.object([:]).isTruthy)
    }

    @Test func theWebsitesNumberChecksHoldAtTheirEdges() {
        #expect(WebRules.timestamp(.number(8.64e15)) != nil && WebRules.timestamp(.number(8.64e15 + 1)) == nil)
        #expect(WebRules.timestamp(.number(0)) == nil && WebRules.timestamp(.number(1.5)) == nil)
        #expect(WebRules.instant(.number(WebRules.earliestInstant)) != nil && WebRules.instant(.number(WebRules.latestInstant)) == nil)
        #expect(WebRules.jsRound(-2.5) == -2 && WebRules.jsRound(2.5) == 3 && WebRules.jsRound(-0.4) == 0)
        #expect(WebRules.day("0099-01-01") == nil && WebRules.day("2026-٠١-01") == nil && WebRules.day("2026-02-29") == nil)
        #expect(WebRules.day("2028-02-29") != nil)
        #expect(WebRules.isDhikrID(String(repeating: "a", count: 100)) && !WebRules.isDhikrID(String(repeating: "a", count: 101)) && !WebRules.isDhikrID(""))
    }
}
