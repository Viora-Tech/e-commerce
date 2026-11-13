/** SOURCE OF TRUTH: LABEL_SHEET_FORMATS, LABEL_SHEET_MAX, labelSheetSize, sheetCells, fitInBox, layoutLabelPages
 * WHAT:  where each courier label page lands when a batch is printed as one file: one per
 *        4 × 6 in thermal page, or four to an A4 sheet (2 × 2), scaled to fit and never
 *        stretched; "Courier's own size" keeps every page as the courier sent it.
 * WHY:   couriers send labels in their own sizes (A4 slips, 4 × 6, 4 × 4); a desk printing
 *        a batch wants one file on one paper. Pure maths, so it is tested without a PDF.
 * WHERE: `mergeLabelSheet` (label-sheet.ts) draws the pages; the admin reads the format ids
 *        from `@commerce/core/label-sheet-layout` for its picker.
 */

/** The merchant's paper: thermal 4 × 6 in, A4 with four labels, or the courier's own pages. */
export const LABEL_SHEET_FORMATS = ['thermal4x6', 'a4x4', 'original'] as const
export type LabelSheetFormat = (typeof LABEL_SHEET_FORMATS)[number]
export const DEFAULT_LABEL_SHEET_FORMAT: LabelSheetFormat = 'thermal4x6'
/** Labels in one file at most: about 25 A4 sheets, and a bounded wait on the couriers. */
export const LABEL_SHEET_MAX = 100

export const isLabelSheetFormat = (v: unknown): v is LabelSheetFormat =>
  typeof v === 'string' && (LABEL_SHEET_FORMATS as readonly string[]).includes(v)

/** PDF points per millimetre (72 per inch). */
const PT_PER_MM = 72 / 25.4
const mm = (n: number) => n * PT_PER_MM

/** 101.6 × 152.4 mm. */
const THERMAL = { width: mm(101.6), height: mm(152.4) }
/** 210 × 297 mm. */
const A4 = { width: mm(210), height: mm(297) }
/** A4's outer margin and the gap between its four labels: room to cut them apart. */
const A4_MARGIN = mm(5)
const A4_GAP = mm(5)

export type Size = { width: number; height: number }
/** PDF coordinates: origin at the page's bottom-left, points. */
export type Box = { x: number; y: number; width: number; height: number }

/** The sheet page size in points; null for "Courier's own size" (each page keeps its own). */
export function labelSheetSize(format: LabelSheetFormat): Size | null {
  if (format === 'thermal4x6') return THERMAL
  if (format === 'a4x4') return A4
  return null
}

/** The label slots on one sheet, in print order (A4: top-left, top-right, bottom-left, bottom-right). */
export function sheetCells(format: LabelSheetFormat): Box[] {
  if (format === 'thermal4x6') return [{ x: 0, y: 0, ...THERMAL }]
  if (format === 'a4x4') {
    const width = (A4.width - 2 * A4_MARGIN - A4_GAP) / 2
    const height = (A4.height - 2 * A4_MARGIN - A4_GAP) / 2
    const cells: Box[] = []
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 2; col++) {
        cells.push({
          x: A4_MARGIN + col * (width + A4_GAP),
          y: A4.height - A4_MARGIN - (row + 1) * height - row * A4_GAP,
          width,
          height,
        })
      }
    }
    return cells
  }
  return []
}

/** Where one label page is drawn: its footprint on the sheet, its scale, and whether it is turned. */
export type Fit = Box & {
  scale: number
  /** Turned a quarter (90° anticlockwise): a landscape label on portrait paper prints larger. */
  rotate: boolean
}

/**
 * The largest size the page fits the box at, keeping its shape, centred. A landscape page is
 * turned when that prints it larger (a wide courier slip on a tall 4 × 6 roll).
 */
export function fitInBox(page: Size, box: Box): Fit {
  const upright = Math.min(box.width / page.width, box.height / page.height)
  const turned = Math.min(box.width / page.height, box.height / page.width)
  const rotate = turned > upright + 1e-9
  const scale = rotate ? turned : upright
  const width = (rotate ? page.height : page.width) * scale
  const height = (rotate ? page.width : page.height) * scale
  return {
    x: box.x + (box.width - width) / 2,
    y: box.y + (box.height - height) / 2,
    width,
    height,
    scale,
    rotate,
  }
}

export type Placement = Fit & { sheet: number }

/**
 * Every label page's sheet and fit, in order: one per thermal page, four per A4 sheet. Empty
 * for "Courier's own size", which copies the pages unchanged.
 */
export function layoutLabelPages(
  pages: Size[],
  format: LabelSheetFormat,
): { sheets: number; placements: Placement[] } {
  const cells = sheetCells(format)
  if (cells.length === 0) return { sheets: pages.length, placements: [] }
  const placements = pages.map((page, i) => ({
    sheet: Math.floor(i / cells.length),
    ...fitInBox(page, cells[i % cells.length] as Box),
  }))
  return { sheets: Math.ceil(pages.length / cells.length), placements }
}
