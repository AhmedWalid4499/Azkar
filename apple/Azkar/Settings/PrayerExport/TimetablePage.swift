import CoreTransferable
import SwiftUI
import UniformTypeIdentifiers

/// One A4 page of the month's timetable, laid out for print: fixed sizes that ignore Dynamic Type,
/// black on white whatever the appearance, right to left in Arabic.
struct TimetablePage: View {
    let document: TimetableDocument
    let rows: [TimetableDocument.Row]
    /// 1-based; shown only when there is more than one page.
    var number = 1
    var count = 1

    static let size = CGSize(width: 595.28, height: 841.89)
    private static let margin: CGFloat = 30
    private static let rowHeight: CGFloat = 19
    private static let green = Color(red: 0x0E / 255, green: 0x6B / 255, blue: 0x54 / 255)

    /// Weekday, date, the other calendar's date, then six equal time columns.
    private static let widths: [CGFloat] = {
        let total = size.width - margin * 2
        let fixed: [CGFloat] = [54, 30, 80]
        let time = (total - fixed.reduce(0, +)) / 6
        return fixed + Array(repeating: time, count: 6)
    }()

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            header
            table.padding(.top, 14)
            Spacer(minLength: 8)
            footer
        }
        .padding(.horizontal, Self.margin)
        .padding(.vertical, 32)
        .frame(width: Self.size.width, height: Self.size.height, alignment: .top)
        .background(Color.white)
        .foregroundStyle(Color.black)
        .environment(\.colorScheme, .light)
        .environment(\.layoutDirection, document.isArabic ? .rightToLeft : .leftToRight)
        .environment(\.dynamicTypeSize, .large)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(document.heading)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Self.green)
            HStack(alignment: .firstTextBaseline) {
                Text(document.title)
                    .font(.system(size: 22, weight: .bold))
                Spacer(minLength: 12)
                Text(document.subtitle)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Color.black.opacity(0.65))
            }
            Text(document.place)
                .font(.system(size: 12, weight: .semibold))
                .padding(.top, 4)
            Text(document.details.joined(separator: "  ·  "))
                .font(.system(size: 9))
                .foregroundStyle(Color.black.opacity(0.6))
        }
        .lineLimit(1)
        .minimumScaleFactor(0.6)
    }

    private var table: some View {
        VStack(spacing: 0) {
            line(document.columns, weight: .semibold, size: 9)
                .foregroundStyle(Color.white)
                .frame(height: 22)
                .background(Self.green, in: UnevenRoundedRectangle(topLeadingRadius: 4, topTrailingRadius: 4))
            ForEach(Array(rows.enumerated()), id: \.offset) { index, row in
                line([row.weekday, row.date, row.otherDate] + row.times, weight: row.isToday ? .bold : .regular, size: 10)
                    .frame(height: Self.rowHeight)
                    .background(background(row, index: index))
                    .overlay(alignment: .bottom) { Rectangle().fill(Color.black.opacity(0.08)).frame(height: 0.5) }
            }
        }
    }

    private func background(_ row: TimetableDocument.Row, index: Int) -> Color {
        if row.isFriday { return Self.green.opacity(0.10) }
        return index.isMultiple(of: 2) ? Color.clear : Color.black.opacity(0.03)
    }

    private func line(_ cells: [String], weight: Font.Weight, size: CGFloat) -> some View {
        HStack(spacing: 0) {
            ForEach(Array(cells.enumerated()), id: \.offset) { column, text in
                Text(text)
                    .font(.system(size: size, weight: weight).monospacedDigit())
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
                    .padding(.horizontal, 4)
                    .frame(width: Self.widths[column], alignment: column == 0 ? .leading : .center)
            }
        }
    }

    private var footer: some View {
        HStack(alignment: .lastTextBaseline) {
            Text(document.footer)
            Spacer(minLength: 8)
            if count > 1 { Text(verbatim: "\(number)/\(count)") }
        }
        .font(.system(size: 8))
        .foregroundStyle(Color.black.opacity(0.5))
        .lineLimit(2)
    }
}

extension TimetableDocument {
    /// Draws each page with `ImageRenderer` into a PDF; text stays text, so it prints sharp and can be searched.
    @MainActor func writePDF(to url: URL) throws {
        var box = CGRect(origin: .zero, size: TimetablePage.size)
        guard let context = CGContext(url as CFURL, mediaBox: &box, nil) else { throw CocoaError(.fileWriteUnknown) }
        let pages = pages
        for (index, rows) in pages.enumerated() {
            let renderer = ImageRenderer(content: TimetablePage(document: self, rows: rows, number: index + 1, count: pages.count))
            renderer.proposedSize = ProposedViewSize(TimetablePage.size)
            renderer.render { _, draw in
                context.beginPDFPage(nil)
                draw(context)
                context.endPDFPage()
            }
        }
        context.closePDF()
    }
}

/// The timetable as a PDF, written to a temporary file only when it is shared.
nonisolated struct TimetableFile: Transferable {
    let document: TimetableDocument

    static var transferRepresentation: some TransferRepresentation {
        FileRepresentation(exportedContentType: .pdf) { file in
            let directory = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString, directoryHint: .isDirectory)
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            let name = file.document.fileName.replacingOccurrences(of: "/", with: "-")
            let url = directory.appending(path: "\(name).pdf")
            let document = file.document
            try await MainActor.run { try document.writePDF(to: url) }
            return SentTransferredFile(url)
        }
    }
}
