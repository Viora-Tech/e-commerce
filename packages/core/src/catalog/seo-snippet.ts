/** SOURCE OF TRUTH: seoSnippet — WHAT: a product's fallback SEO description from its first real sentences / WHY: one rule for the admin preview and the storefront meta tag */
/**
 * The search-result description a product gets when it has no SEO description of its own:
 * its first real sentences, not whatever line comes first. Imported descriptions often open
 * with a spec table ("Specification / Material: Stainless steel / Weight: 58 g"), which made
 * Google's snippet read "Specification Material: Stainless…" (audit #65). Pure, so the admin's
 * preview and the storefront's meta tag say the same thing.
 */

/** "Material: Stainless steel", "Weight - 58 g": a spec row, not a sentence. */
const SPEC_ROW = /^[\p{L}\p{N} ()/&.+-]{1,32}\s*[:：–-]\s*\S/u

/** Lines too short to be prose ("Specification", "Features", "In the box"). */
const MIN_WORDS = 6

function isProse(line: string): boolean {
  const words = line.split(/\s+/).filter(Boolean)
  if (words.length < MIN_WORDS) return false
  return !SPEC_ROW.test(line) || words.length > 14
}

function lines(plain: string): string[] {
  return plain
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

/**
 * Only the prose lines of `plain`, joined; empty when the text is all spec rows and headings,
 * so the storefront can write its own sentence instead of a spec dump.
 */
export function seoProse(plain: string): string {
  return lines(plain).filter(isProse).join(' ')
}

/**
 * Prose lines from `plain` (one block per line, as `richTextToPlainText` gives it), joined;
 * the whole text flattened when it has none.
 */
export function seoSnippet(plain: string): string {
  return seoProse(plain) || lines(plain).join(' ')
}
