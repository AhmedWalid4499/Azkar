#if DEBUG
import AzkarKit
import Foundation

/// Sample history for looking at the tracker in the simulator, written through the store's own
/// merge (the path a restored backup takes). Debug builds only, and only on request:
///
/// - `-AzkarTrackerSeed`: ten weeks of varied prayers, sunnah, azkar sessions (incl. bedtime and
///   after each prayer), tasbih and fasts, last Ramadan, make-up fasts; and Makkah as the place
///   when none is set. Runs once: nothing happens when the store already has records.
/// - `-AzkarTrackerReset`: clears every record first (for the empty state).
/// - `-AzkarTrackerLanguage en|ar|system`: the in-app language.
enum TrackerSeed {
    static func runIfRequested(_ app: AppEnvironment) async {
        let arguments = ProcessInfo.processInfo.arguments
        if let index = arguments.firstIndex(of: "-AzkarTrackerLanguage"), index + 1 < arguments.count,
           let language = AppSettings.Language(rawValue: arguments[index + 1]) {
            app.settings.update { $0.app.language = language }
        }
        if arguments.contains("-AzkarTrackerReset") {
            try? await app.store.replaceAll(with: RecordsSnapshot())
            await app.records.reload()
        }
        guard arguments.contains("-AzkarTrackerSeed") else { return }
        if app.settings.settings.location == nil {
            app.settings.update {
                $0.location = SavedLocation(latitude: 21.4225, longitude: 39.8262, timeZone: "Asia/Riyadh", label: "Makkah",
                                            countryCode: "SA", source: .manual, updatedAt: Date.now.timeIntervalSince1970 * 1000)
            }
        }
        guard (try? await app.store.daysWithRecords().isEmpty) == true else { return }
        let settings = app.settings.settings
        let snapshot = sample(today: DayKey(.now, in: settings.timeZone), now: .now, zone: settings.timeZone, dataset: app.dataset,
                              hijriOffset: settings.app.hijriOffset)
        do {
            try await app.store.merge(snapshot)
        } catch {
            print("Azkar: seeding the tracker failed: \(error)")
        }
        await app.records.reload()
    }

    static func sample(today: DayKey, now: Date, zone: TimeZone, dataset: AzkarDataset, hijriOffset: Int) -> RecordsSnapshot {
        var random = TrackerSplitMix(seed: 1448)
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = zone
        func at(_ day: DayKey, _ hour: Int, _ minute: Int) -> Date {
            calendar.date(from: DateComponents(year: day.year, month: day.month, day: day.day, hour: hour, minute: minute))!
        }
        let prayerHours: [Prayer: (Int, Int)] = [.fajr: (4, 55), .dhuhr: (11, 50), .asr: (15, 10), .maghrib: (17, 40), .isha: (19, 5)]
        var snapshot = RecordsSnapshot()
        let first = today.adding(days: -70)
        var recitations = 0
        let presets = Array(dataset.tasbihIDs.prefix(2)) + (dataset.tasbihIDs.isEmpty ? Array(dataset.items.keys.sorted().prefix(2)) : [])

        for offset in 0...first.days(to: today) {
            let day = first.adding(days: offset)
            let isToday = day == today
            let recent = first.days(to: day) > 60 // the last ten days: a clean run for the current streak
            let excusedSpell = (20...24).contains(offset)

            // Obligatory prayers.
            var record = DayPrayerRecord()
            for prayer in Prayer.allCases {
                let (hour, minute) = prayerHours[prayer]!
                let time = at(day, hour, minute + random.next(5...40))
                if isToday, time > now { continue }
                if random.chance(0.03), !recent { continue } // forgot to log
                let status: PrayerStatus
                if excusedSpell {
                    status = .excused
                } else if !recent, random.chance(0.06) {
                    status = .missed
                } else if !recent, random.chance(0.08) {
                    status = .late
                } else {
                    status = random.chance(prayer == .fajr ? 0.3 : 0.45) ? .jamaah : .ontime
                }
                record.prayers[prayer] = PrayerEntry(status: status, loggedAt: time)
            }
            // Sunnah prayers; none in the excused spell.
            for sunnah in SunnahPrayer.allCases where !excusedSpell {
                let likely: Double = switch sunnah {
                case .beforeFajr: 0.85
                case .witr: recent ? 1 : 0.8
                case .duha: 0.35
                case .qiyam: 0.25
                default: recent ? 0.9 : 0.6
                }
                guard random.chance(likely) else { continue }
                let anchor: Prayer = sunnah.anchors.last!
                let (hour, minute) = prayerHours[anchor]!
                let time = at(day, hour + (sunnah == .qiyam || sunnah == .witr ? 2 : 0), minute + 20)
                if isToday, time > now { continue }
                record.sunnah[sunnah] = time
            }
            if !record.isEmpty { snapshot.prayers[day] = record }

            // Azkar sessions.
            var sessions: [AzkarSession: SessionRecord] = [:]
            func session(_ session: AzkarSession, start: Date, likely: Double, partial: Double = 0.1) {
                if isToday, start > now { return }
                let total = max(dataset.azkar(for: session).count, session == .sleep ? 9 : 7)
                if random.chance(likely) {
                    let repetitions = total * random.next(3...9)
                    let finished = start.addingTimeInterval(Double(random.next(6...18)) * 60)
                    sessions[session] = SessionRecord(startedAt: start, lastAt: finished, completedAt: finished, completed: true,
                                                      done: total, total: total, recitations: repetitions)
                    recitations += repetitions
                } else if random.chance(partial) {
                    let done = random.next(1...max(1, total - 1))
                    sessions[session] = SessionRecord(startedAt: start, lastAt: start.addingTimeInterval(240), completed: false,
                                                      done: done, total: total, recitations: done * 3)
                    recitations += done * 3
                }
            }
            session(.morning, start: at(day, 5, 30 + random.next(0...25)), likely: recent ? 1 : 0.75)
            session(.evening, start: at(day, 16, 20 + random.next(0...30)), likely: recent ? 1 : 0.7)
            session(.sleep, start: at(day, 22, random.next(0...40)), likely: 0.4, partial: 0.05)
            for prayer in Prayer.allCases {
                let (hour, minute) = prayerHours[prayer]!
                session(.afterPrayer(prayer), start: at(day, hour, minute + 15), likely: prayer == .fajr || prayer == .maghrib ? 0.7 : 0.45, partial: 0.05)
            }
            if !sessions.isEmpty { snapshot.sessions[day] = sessions }

            // Tasbih.
            if random.chance(0.45) {
                var counts: [String: TasbihCount] = [:]
                for preset in presets + [TasbihRecord.freeCount] where random.chance(0.6) {
                    let count = random.next(1...4) * 33
                    let time = at(day, 13, random.next(0...59))
                    if isToday, time > now { continue }
                    counts[preset] = TasbihCount(startedAt: time, lastAt: time.addingTimeInterval(300), count: count, current: count % 100)
                    if preset == TasbihRecord.freeCount { snapshot.totals.tasbihFree += count } else { snapshot.totals.tasbih[preset, default: 0] += count }
                }
                if !counts.isEmpty { snapshot.tasbih[day] = counts }
            }

            // Voluntary fasts: most Mondays and Thursdays, and the white days.
            let hijri = HijriCalendar.date(of: day, offset: hijriOffset)
            if !isToday, FastingCalendar.forbiddenDay(hijri) == nil, hijri.month != HijriDate.ramadan {
                if FastingCalendar.isWhiteDay(hijri) || (FastingCalendar.isMondayOrThursday(day) && random.chance(0.8)) {
                    snapshot.fasts[day] = FastRecord(kind: .voluntary, status: random.chance(0.92) ? .fasted : .broken, loggedAt: at(day, 4, 30))
                } else if day.weekday == 7, offset % 3 == 0 {
                    snapshot.fasts[day] = FastRecord(kind: .qada, status: .fasted, loggedAt: at(day, 4, 30))
                }
            }
        }

        // Last Ramadan: fasted, with an excused spell and one fast broken.
        let todayHijri = HijriCalendar.date(of: today, offset: hijriOffset)
        let ramadanYear = todayHijri.month >= HijriDate.ramadan ? todayHijri.year : todayHijri.year - 1
        for (index, day) in HijriCalendar.civilDays(ofYear: ramadanYear, month: HijriDate.ramadan, offset: hijriOffset).enumerated() where day <= today {
            let status: FastStatus = (11...15).contains(index) ? .excused : index == 22 ? .broken : .fasted
            snapshot.fasts[day] = FastRecord(kind: .ramadan, status: status, loggedAt: at(day, 3, 50))
        }
        snapshot.totals.recitations = recitations
        snapshot.owedFastsBefore = 2
        return snapshot
    }
}

/// A small seeded generator, so every seeding writes the same history.
private struct TrackerSplitMix {
    var state: UInt64

    init(seed: UInt64) { state = seed }

    mutating func nextRaw() -> UInt64 {
        state &+= 0x9E37_79B9_7F4A_7C15
        var z = state
        z = (z ^ (z >> 30)) &* 0xBF58_476D_1CE4_E5B9
        z = (z ^ (z >> 27)) &* 0x94D0_49BB_1331_11EB
        return z ^ (z >> 31)
    }

    mutating func chance(_ probability: Double) -> Bool {
        Double(nextRaw() % 10_000) / 10_000 < probability
    }

    mutating func next(_ range: ClosedRange<Int>) -> Int {
        range.lowerBound + Int(nextRaw() % UInt64(range.count))
    }
}
#endif
