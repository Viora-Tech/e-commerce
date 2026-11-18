/** SOURCE OF TRUTH: labelContentBounds, contentStreamBounds
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
 * White fills and strokes (a page-sized white background) are not content.
 */
import {
  decodePDFRawStream,
  PDFArray,
  PDFContentStream,
  PDFDict,
  PDFName,
  PDFNumber,
  type PDFPage,
  PDFRawStream,
} from 'pdf-lib'
import type { Box } from './label-sheet-layout'

type Matrix = [number, number, number, number, number, number]
type Rect = { x0: number; y0: number; x1: number; y1: number }

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0]
/** `m` applied first, then `n` (PDF's row-vector order: `cm` makes CTM = M × CTM). */
const mul = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[1] * n[2],
  m[0] * n[1] + m[1] * n[3],
  m[2] * n[0] + m[3] * n[2],
  m[2] * n[1] + m[3] * n[3],
  m[4] * n[0] + m[5] * n[2] + n[4],
  m[4] * n[1] + m[5] * n[3] + n[5],
]
const apply = (m: Matrix, x: number, y: number): [number, number] => [
  m[0] * x + m[2] * y + m[4],
  m[1] * x + m[3] * y + m[5],
]
/** The axis-aligned box around a rectangle after a transform. */
function transformRect(r: Rect, m: Matrix): Rect {
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
const intersect = (a: Rect, b: Rect | null): Rect | null => {
  if (!b) return a
  const r = {
    x0: Math.max(a.x0, b.x0),
    y0: Math.max(a.y0, b.y0),
    x1: Math.min(a.x1, b.x1),
    y1: Math.min(a.y1, b.y1),
  }
  return r.x1 > r.x0 && r.y1 > r.y0 ? r : null
}
const UNIT: Rect = { x0: 0, y0: 0, x1: 1, y1: 1 }

// ─── Lexer ──────────────────────────────────────────────────────────────────

type Operand = number | { name: string } | { str: Uint8Array } | Operand[] | null
type Token =
  | { t: 'operand'; v: Operand }
  | { t: 'op'; v: string }
  | { t: 'open' }
  | { t: 'close' }
  | { t: 'dictOpen' }
  | { t: 'dictClose' }
  | { t: 'end' }

const isSpace = (c: number) => c === 0 || c === 9 || c === 10 || c === 12 || c === 13 || c === 32
/** ( ) < > [ ] { } / % */
const isDelim = (c: number) =>
  c === 40 ||
  c === 41 ||
  c === 60 ||
  c === 62 ||
  c === 91 ||
  c === 93 ||
  c === 123 ||
  c === 125 ||
  c === 47 ||
  c === 37
const hexVal = (c: number) =>
  c >= 48 && c <= 57 ? c - 48 : c >= 65 && c <= 70 ? c - 55 : c >= 97 && c <= 102 ? c - 87 : -1

class Lexer {
  pos = 0
  constructor(private readonly b: Uint8Array) {}

  next(): Token {
    const b = this.b
    for (;;) {
      while (this.pos < b.length && isSpace(b[this.pos] as number)) this.pos++
      if (this.pos >= b.length) return { t: 'end' }
      if (b[this.pos] !== 37) break
      while (this.pos < b.length && b[this.pos] !== 10 && b[this.pos] !== 13) this.pos++
    }
    const c = b[this.pos] as number
    if (c === 40) return { t: 'operand', v: { str: this.literal() } }
    if (c === 60) {
      if (b[this.pos + 1] === 60) {
        this.pos += 2
        return { t: 'dictOpen' }
      }
      return { t: 'operand', v: { str: this.hex() } }
    }
    if (c === 62) {
      this.pos += b[this.pos + 1] === 62 ? 2 : 1
      return { t: 'dictClose' }
    }
    if (c === 91) {
      this.pos++
      return { t: 'open' }
    }
    if (c === 93) {
      this.pos++
      return { t: 'close' }
    }
    if (c === 123 || c === 125) {
      this.pos++
      return this.next()
    }
    if (c === 47) {
      this.pos++
      return { t: 'operand', v: { name: this.word() } }
    }
    const word = this.word()
    if (word === '') {
      this.pos++
      return this.next()
    }
    const n = Number(word)
    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(word) && Number.isFinite(n)) return { t: 'operand', v: n }
    if (word === 'true' || word === 'false' || word === 'null') return { t: 'operand', v: null }
    return { t: 'op', v: word }
  }

  private word(): string {
    const b = this.b
    const start = this.pos
    while (
      this.pos < b.length &&
      !isSpace(b[this.pos] as number) &&
      !isDelim(b[this.pos] as number)
    )
      this.pos++
    let s = ''
    for (let i = start; i < this.pos; i++) s += String.fromCharCode(b[i] as number)
    return s
  }

  private literal(): Uint8Array {
    const b = this.b
    const out: number[] = []
    let depth = 1
    this.pos++
    while (this.pos < b.length) {
      const c = b[this.pos++] as number
      if (c === 92) {
        const e = b[this.pos++] as number
        if (e >= 48 && e <= 55) {
          let v = e - 48
          for (
            let k = 0;
            k < 2 && (b[this.pos] as number) >= 48 && (b[this.pos] as number) <= 55;
            k++
          )
            v = v * 8 + ((b[this.pos++] as number) - 48)
          out.push(v & 0xff)
        } else if (e === 13) {
          if (b[this.pos] === 10) this.pos++
        } else if (e !== 10) {
          out.push(
            e === 110 ? 10 : e === 114 ? 13 : e === 116 ? 9 : e === 98 ? 8 : e === 102 ? 12 : e,
          )
        }
        continue
      }
      if (c === 40) depth++
      if (c === 41 && --depth === 0) break
      out.push(c)
    }
    return Uint8Array.from(out)
  }

  private hex(): Uint8Array {
    const b = this.b
    const out: number[] = []
    let hi = -1
    this.pos++
    while (this.pos < b.length) {
      const c = b[this.pos++] as number
      if (c === 62) break
      const v = hexVal(c)
      if (v < 0) continue
      if (hi < 0) hi = v
      else {
        out.push(hi * 16 + v)
        hi = -1
      }
    }
    if (hi >= 0) out.push(hi * 16)
    return Uint8Array.from(out)
  }

  /** After an inline image's `ID`: skip its data up to `EI`. */
  skipInlineImage(): void {
    const b = this.b
    this.pos++
    while (this.pos < b.length - 1) {
      if (
        b[this.pos] === 69 &&
        b[this.pos + 1] === 73 &&
        isSpace(b[this.pos - 1] as number) &&
        (this.pos + 2 >= b.length || isSpace(b[this.pos + 2] as number))
      ) {
        this.pos += 2
        return
      }
      this.pos++
    }
    this.pos = b.length
  }
}

// ─── Fonts ──────────────────────────────────────────────────────────────────

type Font = { twoByte: boolean; width: (code: number) => number }
/** A font the page names but does not describe: a generous average glyph. */
const FALLBACK_FONT: Font = { twoByte: false, width: () => 600 }

const num = (d: PDFDict | undefined, key: string): number | undefined =>
  d?.lookupMaybe(PDFName.of(key), PDFNumber)?.asNumber()

function readFont(dict: PDFDict | undefined): Font {
  if (!dict) return FALLBACK_FONT
  const subtype = dict.lookupMaybe(PDFName.of('Subtype'), PDFName)
  if (subtype === PDFName.of('Type0')) {
    const desc = dict.lookupMaybe(PDFName.of('DescendantFonts'), PDFArray)?.lookup(0)
    const cid = desc instanceof PDFDict ? desc : undefined
    const dw = num(cid, 'DW') ?? 1000
    const widths = new Map<number, number>()
    const w = cid?.lookupMaybe(PDFName.of('W'), PDFArray)
    if (w) {
      for (let i = 0; i < w.size(); ) {
        const first = w.lookup(i)
        const second = w.lookup(i + 1)
        if (!(first instanceof PDFNumber)) break
        if (second instanceof PDFArray) {
          for (let k = 0; k < second.size(); k++) {
            const v = second.lookup(k)
            if (v instanceof PDFNumber) widths.set(first.asNumber() + k, v.asNumber())
          }
          i += 2
        } else {
          const third = w.lookup(i + 2)
          if (second instanceof PDFNumber && third instanceof PDFNumber) {
            const last = Math.min(second.asNumber(), first.asNumber() + 65535)
            for (let c = first.asNumber(); c <= last; c++) widths.set(c, third.asNumber())
          }
          i += 3
        }
      }
    }
    return { twoByte: true, width: (code) => widths.get(code) ?? dw }
  }
  const firstChar = num(dict, 'FirstChar') ?? 0
  const arr = dict.lookupMaybe(PDFName.of('Widths'), PDFArray)
  const descriptor = dict.lookupMaybe(PDFName.of('FontDescriptor'), PDFDict)
  const missing = num(descriptor, 'MissingWidth')
  // Type 3 widths are in the font's own glyph space.
  const fm = dict.lookupMaybe(PDFName.of('FontMatrix'), PDFArray)?.lookup(0)
  const unit = subtype === PDFName.of('Type3') && fm instanceof PDFNumber ? fm.asNumber() * 1000 : 1
  if (!arr) return { twoByte: false, width: () => missing ?? 600 }
  const widths: number[] = []
  for (let i = 0; i < arr.size(); i++) {
    const v = arr.lookup(i)
    widths.push(v instanceof PDFNumber ? v.asNumber() * unit : 600)
  }
  return {
    twoByte: false,
    width: (code) => widths[code - firstChar] ?? missing ?? 600,
  }
}

// ─── Interpreter ────────────────────────────────────────────────────────────

type GState = {
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
const WHITE = 0.95
const isWhite = (vals: number[]): boolean => {
  if (vals.length === 1) return (vals[0] as number) >= WHITE
  if (vals.length === 3) return vals.every((v) => v >= WHITE)
  if (vals.length === 4) return vals.every((v) => v <= 1 - WHITE)
  return false
}
/** Work cap: a label is a few thousand operators; a page past this is read as all content. */
const MAX_TOKENS = 2_000_000
const MAX_DEPTH = 8

class TooComplex extends Error {}

type Ctx = { visible: Rect; bounds: Rect | null; tokens: number; seen: Set<unknown> }

function addRect(ctx: Ctx, r: Rect, clip: Rect | null): void {
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

function decodeStream(obj: unknown): Uint8Array | null {
  if (obj instanceof PDFRawStream) return decodePDFRawStream(obj).decode()
  if (obj instanceof PDFContentStream) return obj.getUnencodedContents()
  return null
}

/** A PDF array of numbers (a form's Matrix or BBox); empty when absent. */
const numbers = (arr: PDFArray | undefined): number[] =>
  arr ? arr.asArray().map((v) => (v instanceof PDFNumber ? v.asNumber() : 0)) : []
const nums = (ops: Operand[]): number[] => ops.filter((o): o is number => typeof o === 'number')
const nameOf = (o: Operand | undefined): string | null =>
  o && typeof o === 'object' && 'name' in o ? o.name : null

function run(
  ctx: Ctx,
  bytes: Uint8Array,
  resources: PDFDict | undefined,
  start: GState,
  depth: number,
): void {
  const lex = new Lexer(bytes)
  const stack: GState[] = []
  let gs: GState = { ...start }
  const fonts = new Map<string, Font>()
  let ops: Operand[] = []
  const arrays: Operand[][] = []
  let dictDepth = 0
  /** The path being built, in page space; null when none. */
  let path: Rect | null = null
  let pendingClip = false
  let tm: Matrix = IDENTITY
  let tlm: Matrix = IDENTITY

  const point = (x: number, y: number) => {
    const [px, py] = apply(gs.ctm, x, y)
    path = path
      ? {
          x0: Math.min(path.x0, px),
          y0: Math.min(path.y0, py),
          x1: Math.max(path.x1, px),
          y1: Math.max(path.y1, py),
        }
      : { x0: px, y0: py, x1: px, y1: py }
  }
  const scale = () => Math.sqrt(Math.abs(gs.ctm[0] * gs.ctm[3] - gs.ctm[1] * gs.ctm[2]))
  const paint = (fill: boolean, stroke: boolean) => {
    const p = path as Rect | null
    if (p) {
      if (pendingClip) gs.clip = intersect(p, gs.clip) ?? { x0: 0, y0: 0, x1: 0, y1: 0 }
      const inkFill = fill && !gs.fillWhite
      const inkStroke = stroke && !gs.strokeWhite
      if (inkFill || inkStroke) {
        const grow = inkStroke ? (Math.max(gs.lineWidth, 1) * scale()) / 2 : 0
        addRect(
          ctx,
          { x0: p.x0 - grow, y0: p.y0 - grow, x1: p.x1 + grow, y1: p.y1 + grow },
          gs.clip,
        )
      }
    }
    path = null
    pendingClip = false
  }
  const fontFor = (name: string): Font => {
    const cached = fonts.get(name)
    if (cached) return cached
    const dict = resources
      ?.lookupMaybe(PDFName.of('Font'), PDFDict)
      ?.lookupMaybe(PDFName.of(name), PDFDict)
    const font = readFont(dict)
    fonts.set(name, font)
    return font
  }
  const show = (s: Uint8Array) => {
    const f = gs.font
    let w = 0
    const step = f.twoByte ? 2 : 1
    for (let i = 0; i + step <= s.length; i += step) {
      const code = f.twoByte ? (s[i] as number) * 256 + (s[i + 1] as number) : (s[i] as number)
      w += (f.width(code) / 1000) * gs.fontSize + gs.charSpace
      if (!f.twoByte && code === 32) w += gs.wordSpace
    }
    w *= gs.hScale
    const r = gs.render
    const hidden =
      r === 3 ||
      r === 7 ||
      (gs.fillWhite && gs.strokeWhite) ||
      (gs.fillWhite && (r === 0 || r === 4)) ||
      (gs.strokeWhite && (r === 1 || r === 5))
    if (!hidden && w !== 0) {
      const box = {
        x0: Math.min(0, w),
        x1: Math.max(0, w),
        y0: gs.rise - 0.25 * gs.fontSize,
        y1: gs.rise + 0.9 * gs.fontSize,
      }
      addRect(ctx, transformRect(box, mul(tm, gs.ctm)), gs.clip)
    }
    tm = mul([1, 0, 0, 1, w, 0], tm)
  }
  const nextLine = (tx: number, ty: number) => {
    tlm = mul([1, 0, 0, 1, tx, ty], tlm)
    tm = tlm
  }
  const doXObject = (name: string) => {
    const xobj = resources?.lookupMaybe(PDFName.of('XObject'), PDFDict)?.lookup(PDFName.of(name))
    if (!(xobj instanceof PDFRawStream || xobj instanceof PDFContentStream)) return
    const subtype = xobj.dict.lookupMaybe(PDFName.of('Subtype'), PDFName)
    if (subtype === PDFName.of('Image')) {
      addRect(ctx, transformRect(UNIT, gs.ctm), gs.clip)
      return
    }
    if (subtype !== PDFName.of('Form')) return
    if (depth >= MAX_DEPTH || ctx.seen.has(xobj)) {
      addRect(ctx, ctx.visible, gs.clip)
      return
    }
    const m = numbers(xobj.dict.lookupMaybe(PDFName.of('Matrix'), PDFArray))
    const ctm = mul(m.length === 6 ? (m as Matrix) : IDENTITY, gs.ctm)
    const bb = numbers(xobj.dict.lookupMaybe(PDFName.of('BBox'), PDFArray))
    let clip = gs.clip
    if (bb.length === 4) {
      const [a = 0, b = 0, c = 0, d = 0] = bb
      const box = { x0: Math.min(a, c), y0: Math.min(b, d), x1: Math.max(a, c), y1: Math.max(b, d) }
      clip = intersect(transformRect(box, ctm), clip) ?? { x0: 0, y0: 0, x1: 0, y1: 0 }
    }
    const content = decodeStream(xobj)
    if (!content) return
    ctx.seen.add(xobj)
    const own = xobj.dict.lookupMaybe(PDFName.of('Resources'), PDFDict)
    run(ctx, content, own ?? resources, { ...gs, ctm, clip }, depth + 1)
    ctx.seen.delete(xobj)
  }

  for (;;) {
    if (++ctx.tokens > MAX_TOKENS) throw new TooComplex()
    const tok = lex.next()
    if (tok.t === 'end') break
    if (tok.t === 'dictOpen') {
      dictDepth++
      continue
    }
    if (tok.t === 'dictClose') {
      if (dictDepth > 0 && --dictDepth === 0) ops.push(null)
      continue
    }
    if (dictDepth > 0) continue
    if (tok.t === 'open') {
      arrays.push([])
      continue
    }
    if (tok.t === 'close') {
      const arr = arrays.pop()
      if (arr) (arrays[arrays.length - 1] ?? ops).push(arr)
      continue
    }
    if (tok.t === 'operand') {
      ;(arrays[arrays.length - 1] ?? ops).push(tok.v)
      continue
    }
    const op = tok.v
    const n = nums(ops)
    switch (op) {
      case 'q':
        stack.push({ ...gs })
        break
      case 'Q':
        gs = stack.pop() ?? gs
        break
      case 'cm':
        if (n.length === 6) gs.ctm = mul(n as Matrix, gs.ctm)
        break
      case 'w':
        gs.lineWidth = n[0] ?? gs.lineWidth
        break
      case 'm':
      case 'l':
        point(n[0] ?? 0, n[1] ?? 0)
        break
      case 'c':
        point(n[0] ?? 0, n[1] ?? 0)
        point(n[2] ?? 0, n[3] ?? 0)
        point(n[4] ?? 0, n[5] ?? 0)
        break
      case 'v':
      case 'y':
        point(n[0] ?? 0, n[1] ?? 0)
        point(n[2] ?? 0, n[3] ?? 0)
        break
      case 're': {
        const [x = 0, y = 0, w = 0, h = 0] = n
        point(x, y)
        point(x + w, y)
        point(x, y + h)
        point(x + w, y + h)
        break
      }
      case 'W':
      case 'W*':
        pendingClip = true
        break
      case 'S':
      case 's':
        paint(false, true)
        break
      case 'f':
      case 'F':
      case 'f*':
        paint(true, false)
        break
      case 'B':
      case 'B*':
      case 'b':
      case 'b*':
        paint(true, true)
        break
      case 'n':
        paint(false, false)
        break
      case 'g':
      case 'rg':
      case 'k':
        gs.fillWhite = isWhite(n)
        break
      case 'G':
      case 'RG':
      case 'K':
        gs.strokeWhite = isWhite(n)
        break
      case 'sc':
      case 'scn':
        gs.fillWhite = n.length === ops.length && isWhite(n)
        break
      case 'SC':
      case 'SCN':
        gs.strokeWhite = n.length === ops.length && isWhite(n)
        break
      case 'cs':
        gs.fillWhite = false
        break
      case 'CS':
        gs.strokeWhite = false
        break
      case 'BT':
        tm = IDENTITY
        tlm = IDENTITY
        break
      case 'Tf': {
        const name = nameOf(ops[0])
        if (name) gs.font = fontFor(name)
        gs.fontSize = n[0] ?? gs.fontSize
        break
      }
      case 'Tc':
        gs.charSpace = n[0] ?? 0
        break
      case 'Tw':
        gs.wordSpace = n[0] ?? 0
        break
      case 'Tz':
        gs.hScale = (n[0] ?? 100) / 100
        break
      case 'TL':
        gs.leading = n[0] ?? 0
        break
      case 'Ts':
        gs.rise = n[0] ?? 0
        break
      case 'Tr':
        gs.render = n[0] ?? 0
        break
      case 'Td':
        nextLine(n[0] ?? 0, n[1] ?? 0)
        break
      case 'TD':
        gs.leading = -(n[1] ?? 0)
        nextLine(n[0] ?? 0, n[1] ?? 0)
        break
      case 'Tm':
        if (n.length === 6) {
          tlm = n as Matrix
          tm = tlm
        }
        break
      case 'T*':
        nextLine(0, -gs.leading)
        break
      case 'Tj':
      case "'":
      case '"': {
        if (op === '"') {
          gs.wordSpace = n[0] ?? gs.wordSpace
          gs.charSpace = n[1] ?? gs.charSpace
        }
        if (op !== 'Tj') nextLine(0, -gs.leading)
        const s = ops[ops.length - 1]
        if (s && typeof s === 'object' && 'str' in s) show(s.str)
        break
      }
      case 'TJ': {
        const arr = ops[0]
        if (!Array.isArray(arr)) break
        for (const item of arr) {
          if (typeof item === 'number') {
            tm = mul([1, 0, 0, 1, (-item / 1000) * gs.fontSize * gs.hScale, 0], tm)
          } else if (item && typeof item === 'object' && 'str' in item) show(item.str)
        }
        break
      }
      case 'Do': {
        const name = nameOf(ops[0])
        if (name) doXObject(name)
        break
      }
      case 'BI':
        // Inline image: its dictionary runs to ID, then raw data to EI.
        for (;;) {
          const t = lex.next()
          if (t.t === 'end') break
          if (t.t === 'op' && t.v === 'ID') {
            lex.skipInlineImage()
            break
          }
        }
        addRect(ctx, transformRect(UNIT, gs.ctm), gs.clip)
        break
      case 'sh':
        addRect(ctx, ctx.visible, gs.clip)
        break
      case 'd0':
      case 'd1':
        break
    }
    ops = []
    arrays.length = 0
  }
}

/** The page's visible area, PDF user space (its crop box, which defaults to the media box). */
const visibleBox = (page: PDFPage): Rect => {
  const b = page.getCropBox()
  return { x0: b.x, y0: b.y, x1: b.x + b.width, y1: b.y + b.height }
}

/**
 * The drawn area of the content stream `bytes`, inside `visible`, or null when nothing is
 * drawn there. `resources` names the fonts and images the stream uses.
 */
export function contentStreamBounds(
  bytes: Uint8Array,
  resources: PDFDict | undefined,
  visible: Rect,
): Rect | null {
  const ctx: Ctx = { visible, bounds: null, tokens: 0, seen: new Set() }
  run(
    ctx,
    bytes,
    resources,
    {
      ctm: IDENTITY,
      clip: null,
      fillWhite: false,
      strokeWhite: false,
      lineWidth: 1,
      font: FALLBACK_FONT,
      fontSize: 0,
      charSpace: 0,
      wordSpace: 0,
      hScale: 1,
      leading: 0,
      rise: 0,
      render: 0,
    },
    0,
  )
  return ctx.bounds
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
