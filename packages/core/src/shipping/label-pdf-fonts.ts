/** SOURCE OF TRUTH: Font, FALLBACK_FONT, readFont
 * WHAT:  a PDF font's glyph widths (simple, Type 3 and Type 0 / CID fonts), so text on a
 *        label page gets a width without rendering it.
 * WHY:   label-content-bounds must know how far right a line of text reaches.
 * WHERE: label-pdf-interpreter.ts.
 */
import { PDFArray, PDFDict, PDFName, PDFNumber } from 'pdf-lib'

export type Font = { twoByte: boolean; width: (code: number) => number }
/** A font the page names but does not describe: a generous average glyph. */
export const FALLBACK_FONT: Font = { twoByte: false, width: () => 600 }

export const num = (d: PDFDict | undefined, key: string): number | undefined =>
  d?.lookupMaybe(PDFName.of(key), PDFNumber)?.asNumber()

export function readFont(dict: PDFDict | undefined): Font {
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
