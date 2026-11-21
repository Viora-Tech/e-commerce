/** SOURCE OF TRUTH: renderManifestSheet
 * WHAT:  draws pickup manifests as one A4 PDF: per courier pickup, a header (courier, pickup
 *        date and place, store, manifest reference), a table of parcels (AWB, order, ship-to
 *        name, city and PIN, weight, COD amount or Prepaid), the count line and signature lines
 *        for the store and the courier's pickup executive.
 * WHY:   the printed list the pickup executive signs when collecting parcels. Our own record,
 *        never sent to the courier.
 * WHERE: `printManifestSheet` (packages/api manifest-sheet.service.ts); grouping and totals in
 *        manifest-sheet.ts. Sizes here are PDF points (1/72 in), not CSS.
 */
import { type ManifestLine, type ManifestSection, manifestTotals } from './manifest-sheet'

/** A4 portrait. */
const PAGE: [number, number] = [595.28, 841.89]
const MARGIN = 36
const BODY = 8.5
const ROW = 16
/** Space kept under the last row for the count and signature block. */
const FOOTER_SPACE = 150

type Column = { title: string; width: number; align?: 'right' }
const COLUMNS: Column[] = [
  { title: '#', width: 22 },
  { title: 'AWB', width: 104 },
  { title: 'Order', width: 50 },
  { title: 'Ship to', width: 112 },
  { title: 'City / PIN', width: 112 },
  { title: 'Weight', width: 45, align: 'right' },
  { title: 'COD / Prepaid', width: 78, align: 'right' },
]

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** `2026-11-18` → `18 Nov 2026`. */
export function manifestDate(day: string | null): string {
  const m = day?.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return '-'
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1] ?? m[2]} ${m[1]}`
}

/** Paise as `Rs. 1,299` (or `Rs. 1,299.50`): the standard PDF fonts have no rupee sign. */
export function manifestMoney(paise: number): string {
  const rupees = paise / 100
  const digits = Number.isInteger(rupees) ? 0 : 2
  const text = rupees.toLocaleString('en-IN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
  return `Rs. ${text}`
}

/** Grams as `0.50 kg`; `-` when unknown. */
export function manifestWeight(grams: number | null): string {
  return grams && grams > 0 ? `${(grams / 1000).toFixed(2)} kg` : '-'
}

/** The table cells of one parcel, in column order. */
export function manifestCells(line: ManifestLine, index: number): string[] {
  const place = [line.city, line.pincode].filter(Boolean).join(' ')
  return [
    String(index + 1),
    line.waybill,
    line.orderNumber === null ? '-' : `#${line.orderNumber}`,
    line.shipToName?.trim() || '-',
    place || '-',
    manifestWeight(line.weightGrams),
    line.cod ? `COD ${manifestMoney(line.codPaise)}` : 'Prepaid',
  ]
}

/**
 * The standard Helvetica only encodes Latin-1 (WinAnsi): a run of other letters (a name typed
 * in Devanagari) prints as one `?` rather than failing the whole file.
 */
function printable(text: string): string {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/[^ -~ -ÿ]+/g, '?')
}

/**
 * Every section as pages of one A4 PDF; each section starts on a new page and its table runs
 * on to more pages when long, with the header repeated. Pages are numbered at the foot.
 */
export async function renderManifestSheet(
  sections: readonly ManifestSection[],
  meta: { storeName: string; printedAt: string },
): Promise<Uint8Array> {
  // pdf-lib loads here, when someone prints, not with every process that loads core.
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
  const doc = await PDFDocument.create()
  doc.setTitle('Pickup manifest')
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const ink = rgb(0.1, 0.1, 0.1)
  const muted = rgb(0.4, 0.4, 0.4)
  const rule = rgb(0.75, 0.75, 0.75)
  type Font = typeof font
  type Page = ReturnType<typeof doc.addPage>

  /** Cut to fit the width, with `...` when it had to be cut. */
  const fit = (raw: string, f: Font, size: number, width: number) => {
    let text = printable(raw)
    if (f.widthOfTextAtSize(text, size) <= width) return text
    while (text.length > 1 && f.widthOfTextAtSize(`${text}...`, size) > width)
      text = text.slice(0, -1)
    return `${text}...`
  }
  const write = (page: Page, text: string, x: number, y: number, size = BODY, f = font) =>
    page.drawText(printable(text), { x, y, size, font: f, color: ink })
  const line = (page: Page, y: number) =>
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE[0] - MARGIN, y },
      thickness: 0.5,
      color: rule,
    })

  /** A new page with the section's header and the table's column titles; returns the next y. */
  const startPage = (section: ManifestSection, continued: boolean): [Page, number] => {
    const page = doc.addPage(PAGE)
    let y = PAGE[1] - MARGIN - 14
    write(page, continued ? 'Pickup manifest (continued)' : 'Pickup manifest', MARGIN, y, 16, bold)
    const ref = `Ref ${section.manifestId.slice(0, 8).toUpperCase()}`
    write(page, ref, PAGE[0] - MARGIN - font.widthOfTextAtSize(ref, BODY), y + 4, BODY)
    y -= 22
    const facts: [string, string][] = [
      ['Courier', section.courier],
      ['Pickup date', manifestDate(section.pickupDate)],
      ['Pickup place', section.pickupPlace ?? '-'],
      ['Store', meta.storeName || '-'],
    ]
    for (const [label, value] of facts) {
      write(page, `${label}:`, MARGIN, y, 10, bold)
      write(page, fit(value, font, 10, PAGE[0] - 2 * MARGIN - 80), MARGIN + 80, y, 10)
      y -= 14
    }
    page.drawText(printable(`Printed ${meta.printedAt}`), {
      x: MARGIN,
      y,
      size: BODY,
      font,
      color: muted,
    })
    y -= 18
    let x = MARGIN
    for (const col of COLUMNS) {
      const w = bold.widthOfTextAtSize(col.title, BODY)
      write(page, col.title, col.align === 'right' ? x + col.width - w - 4 : x, y, BODY, bold)
      x += col.width
    }
    line(page, y - 5)
    return [page, y - ROW]
  }

  for (const section of sections) {
    let [page, y] = startPage(section, false)
    section.lines.forEach((parcel, i) => {
      if (y < MARGIN + 30) [page, y] = startPage(section, true)
      let x = MARGIN
      manifestCells(parcel, i).forEach((cell, c) => {
        const col = COLUMNS[c] as Column
        const text = fit(cell, font, BODY, col.width - 6)
        const w = font.widthOfTextAtSize(text, BODY)
        write(page, text, col.align === 'right' ? x + col.width - w - 4 : x, y)
        x += col.width
      })
      line(page, y - 5)
      y -= ROW
    })

    if (y < MARGIN + FOOTER_SPACE) [page, y] = startPage(section, true)
    const t = manifestTotals(section.lines)
    y -= 8
    write(page, `Total parcels: ${t.parcels}`, MARGIN, y, 11, bold)
    const cod = `COD: ${t.codParcels} (${manifestMoney(t.codPaise)})`
    const rest = `Prepaid: ${t.prepaidParcels}   Weight: ${manifestWeight(t.weightGrams)}`
    write(page, `${cod}   ${rest}`, MARGIN + 130, y, 10)
    y -= 40
    const half = (PAGE[0] - 2 * MARGIN) / 2
    const signature = (x: number, title: string) => {
      write(page, title, x, y, 10, bold)
      for (const [k, label] of ['Name', 'Signature', 'Date and time'].entries()) {
        const at = y - 24 - k * 22
        write(page, `${label}:`, x, at, 9)
        page.drawLine({
          start: { x: x + 70, y: at - 2 },
          end: { x: x + half - 20, y: at - 2 },
          thickness: 0.5,
          color: ink,
        })
      }
    }
    signature(MARGIN, 'Handed over by (store)')
    signature(MARGIN + half, 'Received by (courier pickup executive)')
  }

  const pages = doc.getPages()
  pages.forEach((p, i) => {
    const text = `Page ${i + 1} of ${pages.length}`
    p.drawText(text, {
      x: PAGE[0] - MARGIN - font.widthOfTextAtSize(text, 7.5),
      y: MARGIN / 2,
      size: 7.5,
      font,
      color: muted,
    })
  })
  return doc.save()
}
