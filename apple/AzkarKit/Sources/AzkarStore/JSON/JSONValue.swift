import Foundation

/// Any JSON value, read the way JavaScript's `JSON.parse` reads it: every number is a `Double`.
/// The website's stored data is checked field by field, so it is handled as JSON rather than
/// decoded into fixed types that would throw away a whole store for one bad field.
public enum JSONValue: Hashable, Sendable {
    case null
    case bool(Bool)
    case number(Double)
    case string(String)
    case array([JSONValue])
    case object([String: JSONValue])

    /// Parses JSON text as `JSON.parse` does, or `nil` where it would throw.
    public init?(parsing text: String) {
        guard let value = try? JSONDecoder().decode(JSONValue.self, from: Data(text.utf8)) else { return nil }
        self = value
    }

    /// `JSON.stringify(value)`: compact, keys sorted so equal values give equal text.
    public var text: String {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
        return (try? String(decoding: encoder.encode(self), as: UTF8.self)) ?? "null"
    }

    public subscript(key: String) -> JSONValue? {
        if case let .object(object) = self { object[key] } else { nil }
    }

    public var object: [String: JSONValue]? {
        if case let .object(object) = self { object } else { nil }
    }

    public var number: Double? {
        if case let .number(number) = self { number } else { nil }
    }

    public var string: String? {
        if case let .string(string) = self { string } else { nil }
    }

    public var bool: Bool? {
        if case let .bool(bool) = self { bool } else { nil }
    }

    public var array: [JSONValue]? {
        if case let .array(array) = self { array } else { nil }
    }

    /// JavaScript's truthiness, for the few places the website tests a value with `if (value)`.
    var isTruthy: Bool {
        switch self {
        case .null: false
        case let .bool(bool): bool
        case let .number(number): number != 0 && !number.isNaN
        case let .string(string): !string.isEmpty
        case .array, .object: true
        }
    }
}

extension JSONValue: Codable {
    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self = .null
        } else if let bool = try? container.decode(Bool.self) {
            self = .bool(bool)
        } else if let number = try? container.decode(Double.self) {
            self = .number(number)
        } else if let string = try? container.decode(String.self) {
            self = .string(string)
        } else if let array = try? container.decode([JSONValue].self) {
            self = .array(array)
        } else {
            self = .object(try container.decode([String: JSONValue].self))
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .null: try container.encodeNil()
        case let .bool(bool): try container.encode(bool)
        case let .number(number):
            // Whole numbers as integers, as JSON.stringify writes them (and never "-0").
            if number.rounded() == number, abs(number) < 9_007_199_254_740_992 {
                try container.encode(Int64(number))
            } else {
                try container.encode(number)
            }
        case let .string(string): try container.encode(string)
        case let .array(array): try container.encode(array)
        case let .object(object): try container.encode(object)
        }
    }
}

extension JSONValue: ExpressibleByNilLiteral, ExpressibleByBooleanLiteral, ExpressibleByIntegerLiteral,
    ExpressibleByFloatLiteral, ExpressibleByStringLiteral, ExpressibleByArrayLiteral, ExpressibleByDictionaryLiteral {
    public init(nilLiteral: ()) { self = .null }
    public init(booleanLiteral value: Bool) { self = .bool(value) }
    public init(integerLiteral value: Int) { self = .number(Double(value)) }
    public init(floatLiteral value: Double) { self = .number(value) }
    public init(stringLiteral value: String) { self = .string(value) }
    public init(arrayLiteral elements: JSONValue...) { self = .array(elements) }
    public init(dictionaryLiteral elements: (String, JSONValue)...) {
        self = .object(Dictionary(elements, uniquingKeysWith: { _, last in last }))
    }
}

extension JSONValue {
    init(_ int: Int) { self = .number(Double(int)) }
    init(_ string: String?) { self = string.map(JSONValue.string) ?? .null }
    init(_ bool: Bool?) { self = bool.map(JSONValue.bool) ?? .null }
    init(ms date: Date) { self = .number(Double(date.epochMilliseconds)) }
}
