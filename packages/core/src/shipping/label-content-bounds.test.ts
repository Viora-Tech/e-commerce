/** SOURCE OF TRUTH: tests for ./label-content-bounds.ts — the drawn area of a label PDF page. */
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { labelContentBounds } from './label-content-bounds'

const A4: [number, number] = [595.28, 841.89]
const close = (a: number, b: number) => expect(a).toBeCloseTo(b, 2)

/** A 1 × 1 PNG. */
const PNG = Uint8Array.from(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  ),
)

/** Saved and loaded again, as a courier's file arrives. */
async function reload(doc: PDFDocument) {
  return (await PDFDocument.load(await doc.save())).getPage(0)
}

describe('labelContentBounds', () => {
  it('finds a label box on an A4 page and ignores the white page behind it', async () => {
    const doc = await PDFDocument.create()
    const page = doc.addPage(A4)
    page.drawRectangle({ x: 0, y: 0, width: A4[0], height: A4[1], color: rgb(1, 1, 1) })
    page.drawRectangle({ x: 40, y: 420, width: 280, height: 400, color: rgb(0, 0, 0) })
    const b = labelContentBounds(await reload(doc))
    close(b?.x ?? 0, 40)
    close(b?.y ?? 0, 420)
    close(b?.width ?? 0, 280)
    close(b?.height ?? 0, 400)
  })

  it('counts a stroke out to half its width', async () => {
    const doc = await PDFDocument.create()
    const page = doc.addPage(A4)
    page.drawRectangle({
      x: 100,
      y: 100,
      width: 100,
      height: 100,
      borderColor: rgb(0, 0, 0),
      borderWidth: 4,
    })
    const b = labelContentBounds(await reload(doc))
    close(b?.x ?? 0, 98)
    close(b?.width ?? 0, 104)
  })

  it('reads text from where it starts, a little generously to its right', async () => {
    const doc = await PDFDocument.create()
    const font = await doc.embedFont(StandardFonts.Helvetica)
    const page = doc.addPage(A4)
    page.drawText('AWB 1234567890', { x: 60, y: 700, size: 12, font })
    const b = labelContentBounds(await reload(doc))
    close(b?.x ?? 0, 60)
    expect(b?.y ?? 0).toBeLessThan(700)
    expect((b?.y ?? 0) + (b?.height ?? 0)).toBeGreaterThan(700 + 8)
    // Real width is about 85 pt; never under it, never page-wide.
    expect(b?.width ?? 0).toBeGreaterThanOrEqual(80)
    expect(b?.width ?? 0).toBeLessThan(150)
  })

  it('places an image by its transform', async () => {
    const doc = await PDFDocument.create()
    const img = await doc.embedPng(PNG)
    const page = doc.addPage(A4)
    page.drawImage(img, { x: 300, y: 50, width: 120, height: 60 })
    const b = labelContentBounds(await reload(doc))
    close(b?.x ?? 0, 300)
    close(b?.y ?? 0, 50)
    close(b?.width ?? 0, 120)
    close(b?.height ?? 0, 60)
  })

  it('follows a page drawn inside the page (a form XObject), scaled', async () => {
    const inner = await PDFDocument.create()
    inner
      .addPage([200, 200])
      .drawRectangle({ x: 50, y: 50, width: 100, height: 100, color: rgb(0, 0, 0) })
    const doc = await PDFDocument.create()
    const [embedded] = await doc.embedPdf(await inner.save())
    const page = doc.addPage(A4)
    if (embedded) page.drawPage(embedded, { x: 10, y: 20, xScale: 0.5, yScale: 0.5 })
    const b = labelContentBounds(await reload(doc))
    close(b?.x ?? 0, 10 + 25)
    close(b?.y ?? 0, 20 + 25)
    close(b?.width ?? 0, 50)
    close(b?.height ?? 0, 50)
  })

  it('is null when only white is drawn', async () => {
    const doc = await PDFDocument.create()
    const page = doc.addPage(A4)
    page.drawRectangle({ x: 0, y: 0, width: A4[0], height: A4[1], color: rgb(1, 1, 1) })
    expect(labelContentBounds(await reload(doc))).toBeNull()
  })
})
