import { theme } from '../emails/theme'
import { type DesignStyles, EMAIL_FONTS, STYLE_LIMITS } from './style-types'

/**
 * The email's own styles laid over the drawn HTML. Every block writes the built-in tokens as
 * literal inline styles (email clients strip `<style>` and variables), so the font, the text and
 * heading colours and the text size are swapped in the finished HTML: the built-in font stack
 * for the chosen one, `color:` of the ink and body tokens for the merchant's, and every px size
 * scaled from the 15px body. Backgrounds (`background-color:`) are never touched, so a button
 * drawn in ink stays a button. Pure.
 */

/** React writes `'` in attributes as `&#x27;` (older versions `&#39;`). */
const escaped = (s: string) => [s.replace(/'/g, '&#x27;'), s.replace(/'/g, '&#39;'), s]

function swapFont(html: string, font: string): string {
  const to = font.replace(/'/g, '&#x27;')
  let out = html
  for (const from of escaped(theme.fontFamily)) out = out.split(from).join(to)
  return out
}

/** `color:#xxxxxx` as a text colour, not the tail of `background-color:` or `border-color:`. */
function swapColour(html: string, from: string, to: string): string {
  const re = new RegExp(`(^|[^-\\w])color:\\s*${from}`, 'gi')
  return html.replace(re, (_m, lead: string) => `${lead}color:${to}`)
}

function scaleSizes(html: string, factor: number): string {
  const scale = (n: string) => {
    const v = Math.round(Number(n) * factor * 2) / 2
    return Number.isInteger(v) ? String(v) : v.toFixed(1)
  }
  return html.replace(
    /(font-size|line-height):\s*(\d+(?:\.\d+)?)px/g,
    (_m, prop: string, n: string) => `${prop}:${scale(n)}px`,
  )
}

export function applyDesignLook(html: string, styles: DesignStyles | undefined): string {
  if (!styles) return html
  let out = html
  if (styles.font && styles.font !== 'times') out = swapFont(out, EMAIL_FONTS[styles.font])
  if (styles.heading) out = swapColour(out, theme.ink, styles.heading)
  if (styles.text) out = swapColour(out, theme.body, styles.text)
  if (styles.size && styles.size !== STYLE_LIMITS.sizeBase) {
    out = scaleSizes(out, styles.size / STYLE_LIMITS.sizeBase)
  }
  return out
}
