import { DEMO_ORDERS } from './demo-orders'

/**
 * DEMO DATA for the hero "build your store" sequence. Everything here is made up to show what a
 * store looks like: the names, prices and the order are not real. Simple templates per category,
 * with a generic fallback built from whatever the visitor typed.
 */
export type DemoProduct = { name: string; price: number }

export type DemoStore = {
  name: string
  tagline: string
  products: [DemoProduct, DemoProduct, DemoProduct]
  city: string
  firstPrice: number
}

type Category = {
  keywords: readonly string[]
  noun: string
  tagline: string
  products: [DemoProduct, DemoProduct, DemoProduct]
}

const CATEGORIES: readonly Category[] = [
  {
    keywords: ['jewel', 'jewell', 'earring', 'jhumka', 'necklace', 'ring', 'bangle'],
    noun: 'Jewels',
    tagline: 'Handmade, one piece at a time',
    products: [
      { name: 'Kundan Jhumkas', price: 1299 },
      { name: 'Silver Anklet', price: 899 },
      { name: 'Meenakari Ring', price: 649 },
    ],
  },
  {
    keywords: ['kurta', 'saree', 'sari', 'cloth', 'dress', 'fashion', 'shirt', 'lehenga', 'wear'],
    noun: 'Weaves',
    tagline: 'Everyday wear, made with care',
    products: [
      { name: 'Cotton Kurta', price: 1299 },
      { name: 'Block-print Dupatta', price: 799 },
      { name: 'Chikankari Set', price: 2499 },
    ],
  },
  {
    keywords: ['phone', 'cover', 'case', 'gadget', 'charger', 'earbud', 'electronic', 'cable'],
    noun: 'Cases',
    tagline: 'Cases and gear that last',
    products: [
      { name: 'Marble Phone Case', price: 499 },
      { name: 'Clear Armor Case', price: 699 },
      { name: 'MagSafe Wallet', price: 1099 },
    ],
  },
  {
    keywords: ['tea', 'chai', 'coffee', 'spice', 'snack', 'food', 'organic', 'honey', 'pickle'],
    noun: 'Leaf & Co',
    tagline: 'Small-batch and fresh',
    products: [
      { name: 'Darjeeling First Flush', price: 899 },
      { name: 'Masala Chai Blend', price: 349 },
      { name: 'Assam CTC 500 g', price: 449 },
    ],
  },
  {
    keywords: ['candle', 'decor', 'home', 'lamp', 'pot', 'plant', 'furniture', 'art'],
    noun: 'Home',
    tagline: 'Things that make a house a home',
    products: [
      { name: 'Soy Wax Candle', price: 599 },
      { name: 'Terracotta Planter', price: 449 },
      { name: 'Brass Diya Set', price: 1199 },
    ],
  },
]

export const DEMO_EXAMPLES = [
  'handmade jewellery from Jaipur',
  'kurtas',
  'phone covers',
  'organic tea',
] as const

const STOP_WORDS = new Set([
  'handmade',
  'from',
  'in',
  'and',
  'the',
  'my',
  'i',
  'sell',
  'selling',
  'a',
  'an',
  'of',
])

function titleCase(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
}

/** A city from the demo list that the visitor mentioned, if any. */
function findCity(text: string): string | null {
  const lower = text.toLowerCase()
  return DEMO_ORDERS.find((order) => lower.includes(order.city.toLowerCase()))?.city ?? null
}

/** Turns what the visitor typed into a made-up store: name, tagline and three products. */
export function buildDemoStore(raw: string): DemoStore {
  const text = raw.trim()
  const lower = text.toLowerCase()
  const city = findCity(text)
  const category = CATEGORIES.find((item) => item.keywords.some((word) => lower.includes(word)))
  if (category) {
    const lead =
      city ?? titleCase(lower.split(/\s+/).find((word) => !STOP_WORDS.has(word)) ?? 'Desi')
    return {
      name: `${lead} ${category.noun}`,
      tagline: category.tagline,
      products: category.products,
      city: city ?? 'Jaipur',
      firstPrice: category.products[0].price,
    }
  }
  const words = lower
    .split(/\s+/)
    .filter((word) => word && !STOP_WORDS.has(word))
    .slice(0, 2)
  const label = words.length > 0 ? words.map(titleCase).join(' ') : 'Everyday'
  return {
    name: `${label} Co.`,
    tagline: 'Made for the way India shops',
    products: [
      { name: `${label} Classic`, price: 499 },
      { name: `${label} Signature`, price: 899 },
      { name: `${label} Deluxe`, price: 1299 },
    ],
    city: city ?? 'Jaipur',
    firstPrice: 499,
  }
}

export const demoStoreContent = {
  promptLabel: 'What do you sell?',
  promptHint: 'Tell us in a few words and watch your store appear.',
  build: 'Build my store',
  buildShort: 'Build',
  skip: 'Skip',
  startStore: 'Start this store',
  heroTile: 'New arrivals',
  payUpi: 'Pay with UPI',
  upiPaid: (price: string, city: string) => `${price} paid via UPI · ${city}`,
  gstInvoice: 'GST invoice ready',
  shipped: 'Shipped via Delhivery',
  demoNote: 'Demo store, made up for illustration',
  storeAlt: 'A demo storefront built from your answer',
}
