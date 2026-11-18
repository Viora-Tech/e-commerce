/** SOURCE OF TRUTH: labelContentBounds
 * WHAT:  the area of a courier's label PDF page that is actually drawn on (text, lines, boxes,
 *        barcodes, images), in the page's own coordinates, so a 4 × 6 print can cut away the
 *        white around it.
 * WHY:   Delhivery's packing slip (and other couriers' A4 slips) put a small label on a big
 *        white page; fitting the whole page onto 4 × 6 printed the label tiny. Reading the
 *        page's drawing instructions is light (no renderer, no canvas, no new dependency) and
 *        exact for vector labels.
 * WHERE: `mergeLabelSheet` (label-sheet.ts) loads this lazily for the thermal paper; the crop
 *        maths (padding, fallbacks) is `trimToContent` in label-sheet-layout.ts.
 *
 * Over-estimates rather than under-estimates: curve control points count, text width is
 * read from the font's widths (or a generous average when the font has none), and anything
 * it cannot read (shadings without a clip, unknown objects) counts as the whole visible page.
 * White fills and strokes (a page-sized white background) are not content. The reader is
 * split: label-pdf-lexer (tokens), label-pdf-interpreter (operators), label-pdf-state (graphics
 * state, ink box), label-pdf-fonts (glyph widths), label-pdf-geometry (matrices, boxes).
 */
import { PDFArray, type PDFPage } from 'pdf-lib'
import type { Rect } from './label-pdf-geometry'
import { contentStreamBounds } from './label-pdf-interpreter'
import { decodeStream } from './label-pdf-state'
import type { Box } from './label-sheet-layout'

/** The page's visible area, PDF user space (its crop box, which defaults to the media box). */
const visibleBox = (page: PDFPage): Rect => {
  const b = page.getCropBox()
  return { x0: b.x, y0: b.y, x1: b.x + b.width, y1: b.y + b.height }
}

/**
 * Where a label page is drawn on, in the page's user space (the coordinates pdf-lib's
 * `embedPage` bounding box takes). The whole visible page when the page
 * cannot be read (too complex, a broken stream), so a print never loses part of a label;
 * null when nothing at all is drawn.
 */
export function labelContentBounds(page: PDFPage): Box | null {
  const visible = visibleBox(page)
  const whole: Box = {
    x: visible.x0,
    y: visible.y0,
    width: visible.x1 - visible.x0,
    height: visible.y1 - visible.y0,
  }
  try {
    const contents = page.node.Contents()
    const parts: Uint8Array[] = []
    if (contents instanceof PDFArray) {
      for (let i = 0; i < contents.size(); i++) {
        const bytes = decodeStream(contents.lookup(i))
        if (bytes) parts.push(bytes)
      }
    } else {
      const bytes = decodeStream(contents)
      if (bytes) parts.push(bytes)
    }
    const joined = new Uint8Array(parts.reduce((n, p) => n + p.length + 1, 0))
    let at = 0
    for (const p of parts) {
      joined.set(p, at)
      joined[at + p.length] = 10
      at += p.length + 1
    }
    const r = contentStreamBounds(joined, page.node.Resources(), visible)
    if (!r) return null
    return { x: r.x0, y: r.y0, width: r.x1 - r.x0, height: r.y1 - r.y0 }
  } catch {
    return whole
  }
}
