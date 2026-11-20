/** SOURCE OF TRUTH: Lexer, Operand, Token
 * WHAT:  splits a PDF content stream into operands (numbers, names, strings, arrays) and
 *        operators; skips dictionaries' insides, comments and inline image data.
 * WHY:   label-content-bounds reads courier label pages' drawing without a renderer.
 * WHERE: label-pdf-interpreter.ts.
 */

export type Operand = number | { name: string } | { str: Uint8Array } | Operand[] | null
export type Token =
  | { t: 'operand'; v: Operand }
  | { t: 'op'; v: string }
  | { t: 'open' }
  | { t: 'close' }
  | { t: 'dictOpen' }
  | { t: 'dictClose' }
  | { t: 'end' }

export const isSpace = (c: number) =>
  c === 0 || c === 9 || c === 10 || c === 12 || c === 13 || c === 32
/** ( ) < > [ ] { } / % */
export const isDelim = (c: number) =>
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
export const hexVal = (c: number) =>
  c >= 48 && c <= 57 ? c - 48 : c >= 65 && c <= 70 ? c - 55 : c >= 97 && c <= 102 ? c - 87 : -1

export class Lexer {
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
