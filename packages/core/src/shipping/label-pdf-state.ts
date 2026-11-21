/** SOURCE OF TRUTH: GState, Ctx, isWhite, addRect, decodeStream, numbers, nums, nameOf, MAX_TOKENS, MAX_DEPTH, TooComplex
 * WHAT:  the graphics state the content-stream reader carries, and the running box of ink
 *        it collects (clipped, inside the visible page).
 * WHY:   kept apart from the operator loop so each file stays small.
 * WHERE: label-pdf-interpreter.ts.
 */
import {
  decodePDFRawStream,
  type PDFArray,
  PDFContentStream,
  PDFNumber,
  PDFRawStream,
} from 'pdf-lib'
import type { Font } from './label-pdf-fonts'
import { intersect, type Matrix, type Rect } from './label-pdf-geometry'
import type { Operand } from './label-pdf-lexer'

export type GState = {
  ctm: Matrix
  clip: Rect | null
  fillWhite: boolean
  strokeWhite: boolean
  lineWidth: number
  font: Font
  fontSize: number
  charSpace: number
  wordSpace: number
  hScale: number
  leading: number
  rise: number
  render: number
}

/** Whiter than this (0–1) is paper, not ink. */
export const WHITE = 0.95
export const isWhite = (vals: number[]): boolean => {
  if (vals.length === 1) return (vals[0] as number) >= WHITE
  if (vals.length === 3) return vals.every((v) => v >= WHITE)
  if (vals.length === 4) return vals.every((v) => v <= 1 - WHITE)
  return false
}
/** Work cap: a label is a few thousand operators; a page past this is read as all content. */
export const MAX_TOKENS = 2_000_000
export const MAX_DEPTH = 8

export class TooComplex extends Error {}

export type Ctx = { visible: Rect; bounds: Rect | null; tokens: number; seen: Set<unknown> }

export function addRect(ctx: Ctx, r: Rect, clip: Rect | null): void {
  const vis = intersect(r, clip)
  const inPage = vis && intersect(vis, ctx.visible)
  if (!inPage) return
  const b = ctx.bounds
  ctx.bounds = b
    ? {
        x0: Math.min(b.x0, inPage.x0),
        y0: Math.min(b.y0, inPage.y0),
        x1: Math.max(b.x1, inPage.x1),
        y1: Math.max(b.y1, inPage.y1),
      }
    : inPage
}

export function decodeStream(obj: unknown): Uint8Array | null {
  if (obj instanceof PDFRawStream) return decodePDFRawStream(obj).decode()
  if (obj instanceof PDFContentStream) return obj.getUnencodedContents()
  return null
}

/** A PDF array of numbers (a form's Matrix or BBox); empty when absent. */
export const numbers = (arr: PDFArray | undefined): number[] =>
  arr ? arr.asArray().map((v) => (v instanceof PDFNumber ? v.asNumber() : 0)) : []
export const nums = (ops: Operand[]): number[] =>
  ops.filter((o): o is number => typeof o === 'number')
export const nameOf = (o: Operand | undefined): string | null =>
  o && typeof o === 'object' && 'name' in o ? o.name : null
