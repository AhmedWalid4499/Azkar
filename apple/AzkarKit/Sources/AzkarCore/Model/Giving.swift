import Foundation

/// One thing given. The app records it and never works out what is due.
public struct GivingEntry: Codable, Hashable, Sendable, Identifiable {
    public enum Kind: String, CaseIterable, Codable, Sendable {
        case sadaqah
        case zakat
        case zakatAlFitr
    }

    public static let maxNoteLength = 500

    public var id: UUID
    public var kind: Kind
    public var day: DayKey
    public var at: Date
    /// `nil` when the user would rather not say, or gave something other than money.
    public var amount: Decimal?
    /// ISO 4217, with an amount.
    public var currency: String?
    public var note: String?

    public init(id: UUID = UUID(), kind: Kind, day: DayKey, at: Date, amount: Decimal? = nil, currency: String? = nil, note: String? = nil) {
        self.id = id
        self.kind = kind
        self.day = day
        self.at = at
        // An amount says nothing without a currency, and a currency nothing without an amount.
        let hasAmount = amount.map { $0 > 0 } == true && currency?.isEmpty == false
        self.amount = hasAmount ? amount : nil
        self.currency = hasAmount ? currency : nil
        self.note = note.flatMap(Self.cleaned(note:))
    }

    /// What was typed as an amount, in Western or Arabic digits, with a point or a comma before
    /// the decimals; `nil` for anything else. Text stays out of the way of `Decimal`'s own parsing,
    /// which reads only Western digits.
    public static func parsedAmount(_ text: String) -> Decimal? {
        var digits = ""
        var hasPoint = false
        for scalar in text.trimmingCharacters(in: .whitespaces).unicodeScalars {
            switch scalar.value {
            case 0x30...0x39: digits.unicodeScalars.append(scalar)
            case 0x660...0x669: digits.unicodeScalars.append(Unicode.Scalar(scalar.value - 0x660 + 0x30)!)
            case 0x6F0...0x6F9: digits.unicodeScalars.append(Unicode.Scalar(scalar.value - 0x6F0 + 0x30)!)
            case 0x2E, 0x2C, 0x66B:
                guard !hasPoint else { return nil }
                hasPoint = true
                digits.append(".")
            default:
                return nil
            }
        }
        guard digits != ".", let amount = Decimal(string: digits, locale: Locale(identifier: "en_US_POSIX")), amount > 0 else { return nil }
        return amount
    }

    /// Trimmed, within the limit; `nil` when nothing is left.
    public static func cleaned(note: String) -> String? {
        let text = note.trimmingCharacters(in: .whitespacesAndNewlines)
        return text.isEmpty ? nil : String(text.prefix(maxNoteLength))
    }
}

/// What a set of entries comes to.
public struct GivingSummary: Hashable, Sendable {
    /// One currency's total, never added to another's.
    public struct Total: Hashable, Sendable, Identifiable {
        public var currency: String
        public var amount: Decimal

        public init(currency: String, amount: Decimal) {
            self.currency = currency
            self.amount = amount
        }

        public var id: String { currency }
    }

    public var entries = 0
    /// By kind, each currency once, in the order of its code.
    public var totals: [GivingEntry.Kind: [Total]] = [:]
    /// By kind, entries with no amount.
    public var counts: [GivingEntry.Kind: Int] = [:]

    public init(entries: [GivingEntry]) {
        self.entries = entries.count
        var amounts: [GivingEntry.Kind: [String: Decimal]] = [:]
        for entry in entries {
            counts[entry.kind, default: 0] += 1
            if let amount = entry.amount, let currency = entry.currency {
                amounts[entry.kind, default: [:]][currency, default: 0] += amount
            }
        }
        totals = amounts.mapValues { $0.map { Total(currency: $0.key, amount: $0.value) }.sorted { $0.currency < $1.currency } }
    }
}
