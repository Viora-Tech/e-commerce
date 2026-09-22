import { Font } from '@react-pdf/renderer'
import type { FontId } from '../settings'

/**
 * Vendored fonts (SIL OFL 1.1; licences beside the files in `fonts/`). The
 * body font carries Latin; Noto Sans Devanagari follows it so "₹" and Hindi
 * always print, and Noto Sans SC is appended only when the text needs CJK.
 * Adapted from invoicely's resolve-pdf-font (MIT).
 */
export const FONT_FILES = {
  inter: {
    400: 'inter/Inter-Regular.ttf',
    600: 'inter/Inter-SemiBold.ttf',
    700: 'inter/Inter-Bold.ttf',
  },
  noto: { 400: 'noto/NotoSans-Regular.ttf', 700: 'noto/NotoSans-Bold.ttf' },
  geist: {
    400: 'geist/Geist-Regular.ttf',
    600: 'geist/Geist-SemiBold.ttf',
    700: 'geist/Geist-Bold.ttf',
  },
  devanagari: {
    400: 'noto/NotoSansDevanagari-Regular.ttf',
    700: 'noto/NotoSansDevanagari-Bold.ttf',
  },
  cjk: { 400: 'noto/NotoSansSC-Regular.ttf' },
} as const

type FamilyKey = keyof typeof FONT_FILES

const FAMILY: Record<FamilyKey, string> = {
  inter: 'Invoice Inter',
  noto: 'Invoice Noto Sans',
  geist: 'Invoice Geist',
  devanagari: 'Invoice Noto Devanagari',
  cjk: 'Invoice Noto SC',
}

/** CJK radicals through unified ideographs, compatibility ideographs, full-width forms. */
const CJK = /[⺀-鿿豈-﫿＀-￯]/

let resolved: ((file: string) => string) | null = null

/**
 * Register every family once per process (server) or page (browser).
 * `resolve` maps a file under `fonts/` to a path on disk or a URL.
 */
export function registerFonts(resolve: (file: string) => string): void {
  if (resolved) return
  resolved = resolve
  for (const key of Object.keys(FONT_FILES) as FamilyKey[]) {
    Font.register({
      family: FAMILY[key],
      fonts: Object.entries(FONT_FILES[key]).map(([weight, file]) => ({
        src: resolve(file),
        fontWeight: Number(weight),
      })),
    })
  }
  // Long words (GSTINs, addresses) should wrap at the box edge, not hyphenate.
  Font.registerHyphenationCallback((word) => [word])
}

/** The family stack for a document: body, then Devanagari, then CJK when needed. */
export function fontStack(font: FontId, text: string): string[] {
  const stack = [FAMILY[font], FAMILY.devanagari]
  if (CJK.test(text)) stack.push(FAMILY.cjk)
  return stack
}
