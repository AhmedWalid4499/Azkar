import Foundation
import Testing
@testable import PrayerEngine

@Suite("Qibla")
struct QiblaTests {
    struct File: Decodable {
        /// [latitude, longitude, bearing, distanceKm, near, cardinal]
        let points: [[Value]]
    }

    enum Value: Decodable {
        case number(Double)
        case text(String)

        init(from decoder: Decoder) throws {
            let container = try decoder.singleValueContainer()
            if let number = try? container.decode(Double.self) { self = .number(number) } else { self = .text(try container.decode(String.self)) }
        }

        var number: Double { if case let .number(value) = self { value } else { .nan } }
        var text: String { if case let .text(value) = self { value } else { "" } }
    }

    static let file: File = try! Fixtures.load("qibla.json")

    @Test("Bearing, distance, nearness and compass point are the website's, around the globe")
    func matchesTheWebsite() {
        #expect(Self.file.points.count > 100)
        var degenerate = 0
        for point in Self.file.points {
            let (latitude, longitude) = (point[0].number, point[1].number)
            let direction = QiblaDirection(latitude: latitude, longitude: longitude)
            // At the Kaaba and at its antipode every direction is the Qibla; there the last bit of the
            // platform's sine (V8's against Apple's) decides the angle, so only the distance is compared.
            let antipode = QiblaDirection.distanceToKaabaKm(latitude: -latitude, longitude: longitude > 0 ? longitude - 180 : longitude + 180)
            if direction.isNear || antipode < QiblaDirection.nearKaabaKm {
                degenerate += 1
            } else {
                #expect(abs(direction.bearing - point[2].number) < 1e-6, "\(latitude), \(longitude)")
                #expect(direction.cardinal.rawValue == point[5].text, "\(latitude), \(longitude)")
            }
            #expect(abs(direction.distanceKm - point[3].number) < 1e-6, "\(latitude), \(longitude)")
            #expect(direction.isNear == (point[4].number == 1), "\(latitude), \(longitude)")
        }
        #expect((1...5).contains(degenerate), "\(degenerate) points at the Kaaba or its antipode")
    }

    @Test("Points from true north clockwise: Cairo looks south-east, New York north-east, Jakarta north-west")
    func knownDirections() {
        let cairo = QiblaDirection(latitude: 30.0444, longitude: 31.2357)
        #expect((130...140).contains(cairo.bearing))
        #expect(cairo.cardinal == .se)
        #expect((1200...1350).contains(cairo.distanceKm))
        #expect(QiblaDirection(latitude: 40.7128, longitude: -74.006).cardinal == .ne)
        #expect(QiblaDirection(latitude: -6.2088, longitude: 106.8456).cardinal == .nw)
    }

    @Test("At the Kaaba itself a bearing says nothing, and the screen is told so")
    func nearTheKaaba() {
        #expect(QiblaDirection(latitude: 21.4225241, longitude: 39.8261818).isNear)
        #expect(!QiblaDirection(latitude: 21.43, longitude: 39.84).isNear)
        #expect(CompassPoint(bearing: 359) == .n)
        #expect(CompassPoint(bearing: -45) == .nw)
        #expect(CompassPoint(bearing: 22.5) == .ne)
    }
}
