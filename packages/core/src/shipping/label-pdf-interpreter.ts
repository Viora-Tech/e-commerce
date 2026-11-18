/** SOURCE OF TRUTH: contentStreamBounds
 * WHAT:  runs a PDF content stream's operators (paths, paint, colour, text, images, forms,
 *        clips) and returns the page-space box of everything inked.
 * WHY:   the heart of label-content-bounds: where on a courier's page the label really is.
 * WHERE: labelContentBounds (label-content-bounds.ts).
 */
import { PDFArray, PDFContentStream, PDFDict, PDFName, PDFRawStream } from 'pdf-lib'
import { FALLBACK_FONT, type Font, readFont } from './label-pdf-fonts'
import {
  apply,
  IDENTITY,
  intersect,
  type Matrix,
  mul,
  type Rect,
  transformRect,
  UNIT,
} from './label-pdf-geometry'
import { Lexer, type Operand } from './label-pdf-lexer'
import {
  addRect,
  type Ctx,
  decodeStream,
  type GState,
  isWhite,
  MAX_DEPTH,
  MAX_TOKENS,
  nameOf,
  numbers,
  nums,
  TooComplex,
} from './label-pdf-state'

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
