import Foundation

/// How the azkar reader and the tasbih counter behave, as the website's
/// `src/features/azkar/settingsStore.ts` keeps them (the tasbih fields as its
/// `wip/web-seven-features` branch adds them). Read field by field like `sanitizeAzkarSettings`.
public struct ReaderSettings: Hashable, Sendable {
    public static let arabicScales = 1...5
    /// The tasbih counter's ready-made targets; any whole number up to `maxTasbihTarget` is a custom one.
    public static let tasbihTargets = [33, 99, 100]
    public static let maxTasbihTarget = 100_000
    public static let `default` = ReaderSettings()

    /// Arabic text size step, 1 (smallest) to 5.
    public var arabicScale = 3
    /// `nil` until the user chooses: shown in the English interface, hidden in the Arabic one.
    public var showTransliteration: Bool?
    /// `nil` until the user chooses: shown in the English interface, hidden in the Arabic one.
    public var showTranslation: Bool?
    public var haptics = true
    public var keepAwake = true
    public var autoAdvance = true
    /// The tasbih preset last chosen, by dhikr id; `nil` until one is (the first preset is offered).
    public var tasbihPreset: String?
    /// The tasbih counter counts freely rather than a preset.
    public var tasbihFree = false
    /// Where the tasbih counter signals a round, or `nil` for no target.
    public var tasbihTarget: Int? = 33

    public init() {}

    /// `resolveAid`: the user's choice, else on in English and off in Arabic.
    public static func resolve(_ choice: Bool?, languageCode: String) -> Bool {
        choice ?? !languageCode.hasPrefix("ar")
    }

    /// The same settings made valid: anything out of range goes back to its default, as the website's `update`.
    public func sanitized() -> ReaderSettings { ReaderSettings(web: web) }
}

extension ReaderSettings {
    /// `sanitizeAzkarSettings(value)`.
    public init(web value: JSONValue?) {
        self.init()
        guard let stored = value?.object else { return }
        if let scale = stored["arabicScale"]?.number, WebRules.isInteger(scale), Self.arabicScales.contains(Int(scale)) {
            arabicScale = Int(scale)
        }
        for (key, path) in [("showTransliteration", \ReaderSettings.showTransliteration), ("showTranslation", \.showTranslation)] {
            switch stored[key] {
            case let .bool(choice): self[keyPath: path] = choice
            case .null: self[keyPath: path] = nil
            default: break
            }
        }
        for (key, path) in [("haptics", \ReaderSettings.haptics), ("keepAwake", \.keepAwake), ("autoAdvance", \.autoAdvance), ("tasbihFree", \.tasbihFree)] {
            if let flag = stored[key]?.bool { self[keyPath: path] = flag }
        }
        switch stored["tasbihPreset"] {
        case .null: tasbihPreset = nil
        case let .string(id) where WebRules.isDhikrID(id): tasbihPreset = id
        default: break
        }
        switch stored["tasbihTarget"] {
        case .null: tasbihTarget = nil
        case let .number(target) where WebRules.isInteger(target) && target >= 1 && target <= Double(Self.maxTasbihTarget):
            tasbihTarget = Int(target)
        default: break
        }
    }

    /// What the website's azkar settings store saves.
    public var web: JSONValue {
        [
            "arabicScale": JSONValue(arabicScale),
            "showTransliteration": JSONValue(showTransliteration),
            "showTranslation": JSONValue(showTranslation),
            "haptics": .bool(haptics),
            "keepAwake": .bool(keepAwake),
            "autoAdvance": .bool(autoAdvance),
            "tasbihPreset": JSONValue(tasbihPreset),
            "tasbihFree": .bool(tasbihFree),
            "tasbihTarget": tasbihTarget.map { JSONValue($0) } ?? .null,
        ]
    }

    /// The fields the website's main branch saves (its tests compare exactly these).
    static let mainBranchFields: Set<String> = ["arabicScale", "showTransliteration", "showTranslation", "haptics", "keepAwake", "autoAdvance"]
}

extension ReaderSettings: Codable {
    public init(from decoder: Decoder) throws { self.init(web: try JSONValue(from: decoder)) }
    public func encode(to encoder: Encoder) throws { try web.encode(to: encoder) }
}
