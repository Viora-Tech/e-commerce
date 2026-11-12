/** SOURCE OF TRUTH: Delhivery Protect's shipment categories and how products map to them — WHAT:
 * the 25 categories Delhivery prices its Protect cover by (default rates in basis points, owner's
 * card, 12 Nov 2026), the Shopify-taxonomy branches each one covers (longest prefix wins) and the
 * product-type words that place a product with no category / WHY: the courier drawer, checkout and
 * booking must agree on what one parcel's insurance costs, with no setup. Pure, browser-safe.
 */

export const PROTECT_CATEGORIES = [
  'apparel',
  'bags',
  'footwear',
  'baby',
  'health',
  'beauty',
  'books',
  'grocery',
  'stationery',
  'tools',
  'pets',
  'home_kitchen',
  'electronics',
  'automotive',
  'watches_jewellery',
  'computers',
  'batteries',
  'mobiles',
  'cameras',
  'industrial',
  'musical',
  'sports',
  'toys',
  'undetermined',
  'multi',
] as const

export type ProtectCategory = (typeof PROTECT_CATEGORIES)[number]

/** Delhivery Protect's card as the owner gave it (12 Nov 2026): % of value, in basis points. */
export const DEFAULT_PROTECT_BPS: Record<ProtectCategory, number> = {
  apparel: 25,
  bags: 25,
  footwear: 25,
  baby: 30,
  health: 30,
  beauty: 30,
  books: 35,
  grocery: 35,
  stationery: 35,
  tools: 35,
  pets: 35,
  home_kitchen: 40,
  electronics: 40,
  automotive: 40,
  watches_jewellery: 40,
  computers: 40,
  batteries: 40,
  mobiles: 40,
  cameras: 40,
  industrial: 40,
  musical: 40,
  sports: 40,
  toys: 40,
  undetermined: 60,
  multi: 60,
}

/**
 * Shopify product taxonomy branches → Protect category. The longest matching prefix wins, so
 * `el` (Electronics) is the fallback and `el-7-8` (Computer Accessories) the specific answer.
 * A vertical left out (Gift Cards, Services, Mature, Uncategorized) is Undetermined.
 */
const TAXONOMY: ReadonlyArray<readonly [prefix: string, category: ProtectCategory]> = [
  ['aa', 'apparel'],
  ['aa-2-27', 'watches_jewellery'], // Sunglasses
  ['aa-4', 'bags'], // Handbag & Wallet Accessories
  ['aa-5', 'bags'], // Handbags, Wallets & Cases
  ['aa-6', 'watches_jewellery'], // Jewelry, Watches
  ['aa-7', 'footwear'], // Shoe Accessories
  ['aa-8', 'footwear'], // Shoes
  ['ap-2', 'pets'],
  ['ae-2-7', 'musical'], // Musical Instrument & Orchestra Accessories
  ['ae-2-8', 'musical'], // Musical Instruments
  ['bt', 'baby'],
  ['bi', 'industrial'],
  ['bi-19', 'health'], // Medical
  ['co', 'cameras'],
  ['el', 'electronics'],
  ['el-4-8', 'mobiles'], // Telephony (mobile phones and their accessories)
  ['el-6', 'computers'],
  ['el-6-8', 'mobiles'], // Tablet Computers
  ['el-7-8', 'computers'], // Computer Accessories (mouse pads, wrist rests)
  ['el-7-9', 'computers'], // Computer Components (mice, keyboards, mouse skates)
  ['el-7-12', 'computers'], // Memory
  ['el-7-13', 'computers'], // Memory Accessories
  ['el-7-14', 'mobiles'], // Mobile Phone & Tablet Tripods
  ['el-7-15-1', 'batteries'], // Batteries
  ['el-12', 'computers'], // Networking
  ['el-13', 'computers'], // Print, Copy, Scan & Fax
  ['el-17-1', 'computers'], // Computer Monitors
  ['fb', 'grocery'],
  ['fb-3', 'undetermined'], // Tobacco
  ['fb-4', 'undetermined'], // Cannabis
  ['fr', 'home_kitchen'],
  ['ha', 'tools'],
  ['hb', 'beauty'],
  ['hb-1', 'health'], // Health Care
  ['hg', 'home_kitchen'],
  ['hg-9', 'electronics'], // Household Appliances
  ['lb', 'bags'],
  ['me', 'books'],
  ['os', 'stationery'],
  ['so', 'books'], // Software
  ['sg', 'sports'],
  ['tg', 'toys'],
  ['vp', 'automotive'],
]

/** The Protect category of a Shopify taxonomy id (`el-7-9-11-4-3`), or null when none covers it. */
export function taxonomyProtectCategory(
  categoryId: string | null | undefined,
): ProtectCategory | null {
  const id = categoryId?.trim().toLowerCase()
  if (!id) return null
  let best: { length: number; category: ProtectCategory } | null = null
  for (const [prefix, category] of TAXONOMY) {
    const hit = id === prefix || id.startsWith(`${prefix}-`)
    if (hit && (!best || prefix.length > best.length)) best = { length: prefix.length, category }
  }
  return best?.category ?? null
}

/**
 * Words in a product type that place a product with no taxonomy category: what a gaming
 * peripherals store (Waimers) calls its types, so its parcels price right with no setup.
 */
const TYPE_WORDS: ReadonlyArray<readonly [RegExp, ProtectCategory]> = [
  [
    /\b(mouse|mice|keyboards?|key ?caps?|glass ?pads?|mouse ?pads?|desk ?mats?|skates?|wrist ?rests?|switches|laptops?|monitors?)\b/i,
    'computers',
  ],
  [/\b(headsets?|headphones?|earbuds?|speakers?|microphones?|controllers?)\b/i, 'electronics'],
  [/\b(phone|mobile|tablet)s?\b/i, 'mobiles'],
  [/\b(batter(y|ies)|cells?)\b/i, 'batteries'],
  [/\b(t-?shirts?|hoodies?|apparel|caps?|jerseys?|socks)\b/i, 'apparel'],
  [/\b(bags?|backpacks?|sleeves?)\b/i, 'bags'],
]

/** The Protect category a product type's words point to, or null. */
export function typeProtectCategory(
  productType: string | null | undefined,
): ProtectCategory | null {
  const type = productType?.trim()
  if (!type) return null
  return TYPE_WORDS.find(([words]) => words.test(type))?.[1] ?? null
}
