/** SOURCE OF TRUTH: Matrix, Rect, IDENTITY, UNIT, mul, apply, transformRect, intersect
 * WHAT:  2-D affine maths for reading a PDF page's drawing: transform matrices and boxes.
 * WHY:   label-content-bounds needs the page-space box of every mark it reads.
 * WHERE: label-pdf-interpreter.ts and label-content-bounds.ts.
 */

export type Matrix = [number, number, number, number, number, number]
export type Rect = { x0: number; y0: number; x1: number; y1: number }

export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0]
/** `m` applied first, then `n` (PDF's row-vector order: `cm` makes CTM = M × CTM). */
export const mul = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[1] * n[2],
  m[0] * n[1] + m[1] * n[3],
  m[2] * n[0] + m[3] * n[2],
  m[2] * n[1] + m[3] * n[3],
  m[4] * n[0] + m[5] * n[2] + n[4],
  m[4] * n[1] + m[5] * n[3] + n[5],
]
export const apply = (m: Matrix, x: number, y: number): [number, number] => [
  m[0] * x + m[2] * y + m[4],
  m[1] * x + m[3] * y + m[5],
]
/** The axis-aligned box around a rectangle after a transform. */
export function transformRect(r: Rect, m: Matrix): Rect {
  const pts = [
    apply(m, r.x0, r.y0),
    apply(m, r.x1, r.y0),
    apply(m, r.x0, r.y1),
    apply(m, r.x1, r.y1),
  ]
  return {
    x0: Math.min(...pts.map((p) => p[0])),
    y0: Math.min(...pts.map((p) => p[1])),
    x1: Math.max(...pts.map((p) => p[0])),
    y1: Math.max(...pts.map((p) => p[1])),
  }
}
export const intersect = (a: Rect, b: Rect | null): Rect | null => {
  if (!b) return a
  const r = {
    x0: Math.max(a.x0, b.x0),
    y0: Math.max(a.y0, b.y0),
    x1: Math.min(a.x1, b.x1),
    y1: Math.min(a.y1, b.y1),
  }
  return r.x1 > r.x0 && r.y1 > r.y0 ? r : null
}
export const UNIT: Rect = { x0: 0, y0: 0, x1: 1, y1: 1 }
