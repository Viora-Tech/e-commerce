/** Words of the stem kept in a generated SKU, and letters per word. */
const STEM_WORDS = 3
const STEM_LETTERS = 5

/** Uppercase A-Z0-9 words, accents folded ("Café noir" -> ["CAFE", "NOIR"]). */
function words(text: string): string[] {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean)
}

/**
 * A short code for one option value: sizes and anything with a digit stay as typed ("XL",
 * "128GB"); longer words become three consonants ("Black" -> "BLK", "Yellow" -> "YLW").
 */
function valueCode(value: string): string {
  const joined = words(value).join('')
  if (joined.length <= 3 || /\d/.test(joined)) return joined.slice(0, 8)
  const consonants = (joined[0] + joined.slice(1).replace(/[AEIOU]/g, '')).replace(/(.)\1+/g, '$1')
  if (consonants.length < 3) return joined.slice(0, 3)
  // First two and the last, the way shops abbreviate: "BLCK" -> "BLK", "GRN" stays.
  return consonants.slice(0, 2) + consonants.slice(-1)
}

/**
 * "yuki-mechanical-glass-keyboard" + ["Black", "L"] -> "YUKI-MECHA-GLASS-BLK-L". `taken` holds
 * the product's other SKUs; a clash gets "-2", "-3" and so on.
 */
export function generateSku(stem: string, optionValues: string[], taken: string[]): string {
  const head = words(stem)
    .slice(0, STEM_WORDS)
    .map((w) => w.slice(0, STEM_LETTERS))
  const base = [...head, ...optionValues.map(valueCode)].filter(Boolean).join('-')
  const used = new Set(taken.map((s) => s.trim().toUpperCase()).filter(Boolean))
  let sku = base
  for (let n = 2; used.has(sku); n++) sku = `${base}-${n}`
  return sku
}
