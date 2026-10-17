import { DEMO_ORDERS } from './demo-orders'

/**
 * DEMO DATA for the hero "build your store" sequence. The default store is Waimers (the owner's own
 * brand, waimers.in) with three of its real products and prices; the order, shopper and city are
 * made up. Other typed categories use simple templates with a generic fallback.
 */
export type DemoProduct = { name: string; price: number }

export type DemoStore = {
  name: string
  tagline: string
  /** Real brand assets (Waimers); the generic templates use gradients only. */
  logo?: string
  heroImage?: string
  images?: [string, string, string]
  note: string
  /** Gradient classes for the three product tiles and the hero tile (colour is allowed in the hero). */
  tones: [string, string, string]
  heroTone: string
  products: [DemoProduct, DemoProduct, DemoProduct]
  city: string
  firstPrice: number
}

type Category = {
  keywords: readonly string[]
  noun: string
  tagline: string
  tones: [string, string, string]
  heroTone: string
  products: [DemoProduct, DemoProduct, DemoProduct]
}

const CATEGORIES: readonly Category[] = [
  {
    keywords: ['jewel', 'jewell', 'earring', 'jhumka', 'necklace', 'ring', 'bangle'],
    noun: 'Jewels',
    tagline: 'Handmade, one piece at a time',
    tones: [
      'from-demo-gold-1 to-demo-gold-2',
      'from-demo-silver-1 to-demo-silver-2',
      'from-demo-ruby-1 to-demo-ruby-2',
    ],
    heroTone: 'from-demo-gold-1 via-demo-gold-2 to-demo-ruby-2',
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
    tones: [
      'from-demo-indigo-1 to-demo-indigo-2',
      'from-demo-saffron-1 to-demo-saffron-2',
      'from-demo-rose-1 to-demo-rose-2',
    ],
    heroTone: 'from-demo-indigo-2 via-demo-indigo-1 to-demo-saffron-1',
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
    tones: [
      'from-demo-sky-1 to-demo-sky-2',
      'from-demo-rose-1 to-demo-rose-2',
      'from-demo-teal-1 to-demo-teal-2',
    ],
    heroTone: 'from-demo-sky-2 via-demo-indigo-1 to-demo-rose-2',
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
    tones: [
      'from-demo-green-1 to-demo-green-2',
      'from-demo-tea-1 to-demo-tea-2',
      'from-demo-sand-1 to-demo-sand-2',
    ],
    heroTone: 'from-demo-green-2 via-demo-green-1 to-demo-sand-1',
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
    tones: [
      'from-demo-clay-1 to-demo-clay-2',
      'from-demo-sand-1 to-demo-sand-2',
      'from-demo-green-1 to-demo-green-2',
    ],
    heroTone: 'from-demo-clay-2 via-demo-clay-1 to-demo-sand-1',
    products: [
      { name: 'Soy Wax Candle', price: 599 },
      { name: 'Terracotta Planter', price: 449 },
      { name: 'Brass Diya Set', price: 1199 },
    ],
  },
]

export const DEMO_EXAMPLES = [
  'gaming mice and desk mats',
  'kurtas',
  'phone covers',
  'organic tea',
] as const

/** Waimers: real products and prices from waimers.in; photos in public/brand/waimers. */
const WAIMERS_STORE: DemoStore = {
  name: 'Waimers',
  tagline: 'Gaming mice and desk gear',
  logo: '/brand/waimers/logo-on-dark.png',
  heroImage: '/brand/waimers/veil-glasspad.webp',
  images: [
    '/brand/waimers/a9-mouse.webp',
    '/brand/waimers/veil-glasspad.webp',
    '/brand/waimers/dot-skates.webp',
  ],
  note: 'Demo built from Waimers products',
  tones: [
    'from-demo-indigo-1 to-demo-indigo-2',
    'from-demo-sky-1 to-demo-sky-2',
    'from-demo-teal-1 to-demo-teal-2',
  ],
  heroTone: 'from-demo-indigo-2 via-demo-indigo-1 to-demo-sky-2',
  products: [
    { name: 'ATK A9 Wireless Mouse', price: 2999 },
    { name: 'AbyssGaming Veil Glasspad', price: 7499 },
    { name: 'TALONGAMES Dot Skates', price: 749 },
  ],
  city: 'Mumbai',
  firstPrice: 2999,
}

const GAMING =
  /\b(gaming|mouse|mice|desk|mats?|mousepads?|glasspads?|keyboards?|keycaps?|headsets?|esports|setup)\b/

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
  if (!text || GAMING.test(lower)) return WAIMERS_STORE
  const category = CATEGORIES.find((item) => item.keywords.some((word) => lower.includes(word)))
  if (category) {
    const lead =
      city ?? titleCase(lower.split(/\s+/).find((word) => !STOP_WORDS.has(word)) ?? 'Desi')
    return {
      name: `${lead} ${category.noun}`,
      tagline: category.tagline,
      tones: category.tones,
      heroTone: category.heroTone,
      products: category.products,
      city: city ?? 'Jaipur',
      note: demoStoreContent.demoNote,
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
    tones: [
      'from-demo-indigo-1 to-demo-indigo-2',
      'from-demo-rose-1 to-demo-rose-2',
      'from-demo-saffron-1 to-demo-saffron-2',
    ],
    heroTone: 'from-demo-indigo-2 via-demo-rose-2 to-demo-saffron-2',
    products: [
      { name: `${label} Classic`, price: 499 },
      { name: `${label} Signature`, price: 899 },
      { name: `${label} Deluxe`, price: 1299 },
    ],
    city: city ?? 'Jaipur',
    note: demoStoreContent.demoNote,
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

/** Copy for the outlined fragments drifting behind the hero. Decorative. */
export const heroFragmentsContent = {
  price: '₹2,999',
  invoice: 'GST invoice',
  courier: 'Delhivery',
  bars: [
    { id: 'b1', width: 'w-0.5' },
    { id: 'b2', width: 'w-px' },
    { id: 'b3', width: 'w-1' },
    { id: 'b4', width: 'w-px' },
    { id: 'b5', width: 'w-0.5' },
    { id: 'b6', width: 'w-1' },
    { id: 'b7', width: 'w-px' },
    { id: 'b8', width: 'w-0.5' },
    { id: 'b9', width: 'w-px' },
    { id: 'b10', width: 'w-1' },
    { id: 'b11', width: 'w-0.5' },
    { id: 'b12', width: 'w-px' },
  ],
}
