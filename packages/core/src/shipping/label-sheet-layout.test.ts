/** SOURCE OF TRUTH: tests for ./label-sheet-layout.ts — 4 × 6 fit and the A4 four-up grid. */
import { describe, expect, it } from 'vitest'
import { fitInBox, labelSheetSize, layoutLabelPages, sheetCells } from './label-sheet-layout'

const PT = 72 / 25.4
const close = (a: number, b: number) => expect(a).toBeCloseTo(b, 3)

describe('label sheet sizes', () => {
  it('4 × 6 is 101.6 × 152.4 mm, A4 is 210 × 297 mm, the courier size has none', () => {
    close(labelSheetSize('thermal4x6')?.width ?? 0, 288)
    close(labelSheetSize('thermal4x6')?.height ?? 0, 432)
    close(labelSheetSize('a4x4')?.width ?? 0, 210 * PT)
    close(labelSheetSize('a4x4')?.height ?? 0, 297 * PT)
    expect(labelSheetSize('original')).toBeNull()
  })
})

describe('fitInBox', () => {
  const box = { x: 0, y: 0, width: 288, height: 432 }

  it('keeps a 4 × 6 label exactly as it is', () => {
    const fit = fitInBox({ width: 288, height: 432 }, box)
    expect(fit).toMatchObject({ x: 0, y: 0, width: 288, height: 432, scale: 1, rotate: false })
  })

  it('shrinks an A4 slip to fit, keeping its shape, centred', () => {
    const a4 = { width: 595.28, height: 841.89 }
    const fit = fitInBox(a4, box)
    expect(fit.rotate).toBe(false)
    close(fit.scale, Math.min(288 / a4.width, 432 / a4.height))
    close(fit.width / fit.height, a4.width / a4.height)
    expect(fit.width).toBeLessThanOrEqual(288 + 1e-6)
    expect(fit.height).toBeLessThanOrEqual(432 + 1e-6)
    close(fit.x, (288 - fit.width) / 2)
    close(fit.y, (432 - fit.height) / 2)
  })

  it('grows a 4 × 4 label to the roll width, centred on its height', () => {
    const fit = fitInBox({ width: 288, height: 288 }, box)
    expect(fit).toMatchObject({ x: 0, width: 288, height: 288, scale: 1, rotate: false })
    close(fit.y, 72)
  })

  it('turns a landscape label when that prints it larger', () => {
    const fit = fitInBox({ width: 432, height: 288 }, box)
    expect(fit.rotate).toBe(true)
    close(fit.scale, 1)
    // The footprint on the sheet is the label turned: 288 wide, 432 tall.
    close(fit.width, 288)
    close(fit.height, 432)
  })
})

describe('sheetCells', () => {
  it('4 × 6 has one slot, the whole page', () => {
    const cells = sheetCells('thermal4x6')
    expect(cells).toHaveLength(1)
    expect(cells[0]).toMatchObject({ x: 0, y: 0 })
    close(cells[0]?.width ?? 0, 288)
    close(cells[0]?.height ?? 0, 432)
  })

  it('A4 has four equal slots in reading order, inside a 5 mm margin with a 5 mm gap', () => {
    const cells = sheetCells('a4x4')
    expect(cells).toHaveLength(4)
    const m = 5 * PT
    const w = (210 * PT - 3 * m) / 2
    const h = (297 * PT - 3 * m) / 2
    const [tl, tr, bl, br] = cells
    // PDF y runs up from the bottom: the top row has the larger y.
    close(tl?.x ?? 0, m)
    close(tl?.y ?? 0, m + h + m)
    close(tr?.x ?? 0, m + w + m)
    close(tr?.y ?? 0, tl?.y ?? 0)
    close(bl?.x ?? 0, m)
    close(bl?.y ?? 0, m)
    close(br?.x ?? 0, tr?.x ?? 0)
    close(br?.y ?? 0, m)
    for (const c of cells) {
      close(c.width, w)
      close(c.height, h)
    }
  })

  it('the courier size has no slots', () => {
    expect(sheetCells('original')).toEqual([])
  })
})

describe('layoutLabelPages', () => {
  const label = { width: 288, height: 432 }

  it('puts one label on each 4 × 6 page', () => {
    const { sheets, placements } = layoutLabelPages([label, label, label], 'thermal4x6')
    expect(sheets).toBe(3)
    expect(placements.map((p) => p.sheet)).toEqual([0, 1, 2])
  })

  it('puts four labels on each A4 sheet, in slot order', () => {
    const { sheets, placements } = layoutLabelPages(Array(5).fill(label), 'a4x4')
    expect(sheets).toBe(2)
    expect(placements.map((p) => p.sheet)).toEqual([0, 0, 0, 0, 1])
    const cells = sheetCells('a4x4')
    // Each label sits inside its own slot.
    placements.forEach((p, i) => {
      const c = cells[i % 4]
      expect(p.x).toBeGreaterThanOrEqual((c?.x ?? 0) - 1e-6)
      expect(p.y).toBeGreaterThanOrEqual((c?.y ?? 0) - 1e-6)
      expect(p.x + p.width).toBeLessThanOrEqual((c?.x ?? 0) + (c?.width ?? 0) + 1e-6)
      expect(p.y + p.height).toBeLessThanOrEqual((c?.y ?? 0) + (c?.height ?? 0) + 1e-6)
    })
  })

  it('places nothing for the courier size: pages are copied as sent', () => {
    expect(layoutLabelPages([label, label], 'original')).toEqual({ sheets: 2, placements: [] })
  })
})
