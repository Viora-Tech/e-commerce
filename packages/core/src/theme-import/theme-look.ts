/** SOURCE OF TRUTH: the look an imported theme gives its main sections, read from its own files — WHAT: whether the theme's stylesheet sets headings in capitals (`h1 { text-transform: uppercase }`), lays the product trust badges out as a grid (`.trust-badges { display: grid }`), and draws Add to cart as its primary (filled) button / WHY: Shopify themes keep these in CSS and markup, not settings; our MainProduct and MainCollection replace the theme's main sections on import, so the import reads them here and opens ours the same way (#1048) */
import { archiveText, type ThemeArchive } from './archive'

export type ThemeLook = {
  /** The theme's `h1` rule sets `text-transform: uppercase`: page titles read in capitals. */
  uppercaseTitles: boolean
  /** The theme's `.trust-badges` rule is a grid (Zero Drift's 2×2), not a row of chips. */
  trustBadgesGrid: boolean
  /** The theme's Add to cart button carries its primary (filled) button class. */
  solidAddToCart: boolean
}

/** Longest stylesheet read; a theme's real ones are well under this. */
const CSS_MAX = 2_000_000

/** Each rule of a stylesheet as its selectors and body, comments dropped. One forward pass. */
function cssRules(css: string): { selectors: string[]; body: string }[] {
  const text = css.slice(0, CSS_MAX).replace(/\/\*[\s\S]*?\*\//g, '')
  const out: { selectors: string[]; body: string }[] = []
  for (const chunk of text.split('}')) {
    const open = chunk.lastIndexOf('{')
    if (open === -1) continue
    // Inside `@media … {` the chunk holds the at-rule's brace first: the rule is after the last one.
    const prelude = chunk.slice(chunk.lastIndexOf('{', open - 1) + 1, open)
    out.push({
      selectors: prelude.split(',').map((s) => s.replace(/\s+/g, ' ').trim()),
      body: chunk.slice(open + 1),
    })
  }
  return out
}

/** Add to cart drawn with the primary class (Zero Drift's `btn btn--primary buy-buttons__submit`). */
const PRIMARY_SUBMIT =
  /class="[^"{]*\b(?:btn|button)--primary\b[^"{]*\b(?:buy-buttons__submit|product-form__submit)\b|class="[^"{]*\b(?:buy-buttons__submit|product-form__submit)\b[^"{]*\b(?:btn|button)--primary\b/

/** The theme's look from its files: stylesheets and Liquid. */
export function themeLook(archive: ThemeArchive): ThemeLook {
  const look: ThemeLook = { uppercaseTitles: false, trustBadgesGrid: false, solidAddToCart: false }
  for (const path of archive.files.keys()) {
    const text = archiveText(archive, path)
    if (text === null) continue
    if (/^assets\/[^/]+\.css(\.liquid)?$/.test(path)) {
      for (const rule of cssRules(text)) {
        if (rule.selectors.includes('h1') && /text-transform\s*:\s*uppercase/i.test(rule.body))
          look.uppercaseTitles = true
        if (rule.selectors.includes('.trust-badges') && /display\s*:\s*grid/i.test(rule.body))
          look.trustBadgesGrid = true
      }
    } else if (/^(sections|snippets|blocks)\/[^/]+\.liquid$/.test(path)) {
      if (PRIMARY_SUBMIT.test(text)) look.solidAddToCart = true
    }
  }
  return look
}
