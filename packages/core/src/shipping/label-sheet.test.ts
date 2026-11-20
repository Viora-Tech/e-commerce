/** SOURCE OF TRUTH: tests for ./label-sheet.ts — a batch's labels merged into one PDF. */
import { PDFDocument, rgb } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { labelContentBounds } from './label-content-bounds'
import { mergeLabelSheet } from './label-sheet'

/** A small generated PDF with one page per size. */
async function pdf(...sizes: [number, number][]): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  for (const size of sizes) doc.addPage(size).drawText('AWB 123', { x: 10, y: 10, size: 8 })
  return doc.save()
}

/** A 1 × 1 PNG. */
const PNG = Uint8Array.from(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  ),
)

const pageSizes = async (bytes: Uint8Array | null) =>
  bytes
    ? (await PDFDocument.load(bytes))
        .getPages()
        .map((p) => [Math.round(p.getWidth()), Math.round(p.getHeight())])
    : []

describe('mergeLabelSheet', () => {
  it('4 × 6: one 288 × 432 pt page per label page, whatever size the courier sent', async () => {
    const files = [
      { id: 'a', bytes: await pdf([595, 842]) },
      { id: 'b', bytes: await pdf([288, 432], [288, 288]) },
    ]
    const { pdf: out, unreadable } = await mergeLabelSheet(files, 'thermal4x6')
    expect(unreadable).toEqual([])
    expect(await pageSizes(out)).toEqual([
      [288, 432],
      [288, 432],
      [288, 432],
    ])
  })

  it('4 × 6: an A4 slip with the label in its top part prints the label across the page', async () => {
    const doc = await PDFDocument.create()
    // A ~100 × 150 mm label in the top-left of an A4 page, the rest white.
    doc.addPage([595.28, 841.89]).drawRectangle({
      x: 30,
      y: 400,
      width: 283,
      height: 425,
      borderColor: rgb(0, 0, 0),
      borderWidth: 1,
    })
    const { pdf: out } = await mergeLabelSheet([{ id: 'a', bytes: await doc.save() }], 'thermal4x6')
    const page = out ? (await PDFDocument.load(out)).getPage(0) : null
    const drawn = page ? labelContentBounds(page) : null
    // Fills the 4 × 6 page on at least one side, less the 2 mm edge and 1 mm pad (the whole
    // A4 page fitted printed it at under half).
    const fill = Math.max((drawn?.width ?? 0) / 288, (drawn?.height ?? 0) / 432)
    expect(fill).toBeGreaterThan(0.93)
    expect(drawn?.x ?? 0).toBeGreaterThanOrEqual(0)
    expect((drawn?.x ?? 0) + (drawn?.width ?? 0)).toBeLessThanOrEqual(288)
  })

  it('A4: four labels per sheet', async () => {
    const label = await pdf([288, 432])
    const files = Array.from({ length: 5 }, (_, i) => ({ id: `l${i}`, bytes: label }))
    const { pdf: out } = await mergeLabelSheet(files, 'a4x4')
    expect(await pageSizes(out)).toEqual([
      [595, 842],
      [595, 842],
    ])
  })

  it("courier's own size: pages copied as they are", async () => {
    const files = [
      { id: 'a', bytes: await pdf([595, 842]) },
      { id: 'b', bytes: await pdf([288, 288]) },
    ]
    const { pdf: out } = await mergeLabelSheet(files, 'original')
    expect(await pageSizes(out)).toEqual([
      [595, 842],
      [288, 288],
    ])
  })

  it('leaves out a blank page rather than failing the file', async () => {
    const blank = await PDFDocument.create()
    blank.addPage([288, 432])
    const files = [
      { id: 'blank', bytes: await blank.save() },
      { id: 'label', bytes: await pdf([288, 432]) },
    ]
    const { pdf: out, unreadable } = await mergeLabelSheet(files, 'thermal4x6')
    expect(unreadable).toEqual(['blank'])
    expect(await pageSizes(out)).toEqual([[288, 432]])
  })

  it('takes a PNG label as one label page', async () => {
    const { pdf: out, unreadable } = await mergeLabelSheet(
      [{ id: 'img', bytes: PNG }],
      'thermal4x6',
    )
    expect(unreadable).toEqual([])
    expect(await pageSizes(out)).toEqual([[288, 432]])
  })

  it('leaves out and names a file that is not a PDF or an image; null when nothing printed', async () => {
    const bad = { id: 'bad', bytes: new TextEncoder().encode('<html>login</html>') }
    const good = { id: 'good', bytes: await pdf([288, 432]) }
    const merged = await mergeLabelSheet([bad, good], 'a4x4')
    expect(merged.unreadable).toEqual(['bad'])
    expect(await pageSizes(merged.pdf)).toEqual([[595, 842]])
    expect(await mergeLabelSheet([bad], 'thermal4x6')).toEqual({ pdf: null, unreadable: ['bad'] })
  })
})
