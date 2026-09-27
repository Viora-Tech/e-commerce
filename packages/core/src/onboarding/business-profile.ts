/** SOURCE OF TRUTH: onboarding answers — WHAT the choices the guided /onboarding flow offers (what you sell, where you are based, where you sell today) and the tags/collections each kind of shop starts with / WHY createStore and the admin wizard must agree on the same ids. No database. */
import { z } from 'zod'

/** "What do you sell?" picture cards, in display order. Labels live in the admin's `data/onboarding.ts`. */
export const SELLS_WHAT = [
  'fashion',
  'beauty',
  'jewellery',
  'home',
  'electronics',
  'food',
  'handmade',
  'other',
] as const
export type SellsWhat = (typeof SELLS_WHAT)[number]

/** "Do you already sell somewhere?" choices. `shopify` leads to the Shopify import app after setup. */
export const SELLS_ON = ['shopify', 'website', 'social', 'marketplace', 'none'] as const
export type SellsOn = (typeof SELLS_ON)[number]

/**
 * Starter collections per kind of shop. Each is an automatic collection with a
 * single "tag is <tag>" rule, so tagging a product fills the collection with no
 * extra step. `other` starts with nothing.
 */
const STARTER_COLLECTIONS: Record<SellsWhat, readonly { title: string; tag: string }[]> = {
  fashion: [
    { title: 'Women', tag: 'women' },
    { title: 'Men', tag: 'men' },
    { title: 'Kids', tag: 'kids' },
  ],
  beauty: [
    { title: 'Skin care', tag: 'skin-care' },
    { title: 'Hair care', tag: 'hair-care' },
    { title: 'Makeup', tag: 'makeup' },
  ],
  jewellery: [
    { title: 'Earrings', tag: 'earrings' },
    { title: 'Necklaces', tag: 'necklaces' },
    { title: 'Rings', tag: 'rings' },
  ],
  home: [
    { title: 'Decor', tag: 'decor' },
    { title: 'Kitchen', tag: 'kitchen' },
    { title: 'Bed and bath', tag: 'bed-and-bath' },
  ],
  electronics: [
    { title: 'Accessories', tag: 'accessories' },
    { title: 'Audio', tag: 'audio' },
    { title: 'Gadgets', tag: 'gadgets' },
  ],
  food: [
    { title: 'Snacks', tag: 'snacks' },
    { title: 'Sweets', tag: 'sweets' },
    { title: 'Gift boxes', tag: 'gift-boxes' },
  ],
  handmade: [
    { title: 'Handmade gifts', tag: 'gifts' },
    { title: 'Home decor', tag: 'decor' },
  ],
  other: [],
}

/** Every new store also gets these, whatever it sells. */
const COMMON_COLLECTIONS: readonly { title: string; tag: string }[] = [
  { title: 'New arrivals', tag: 'new' },
  { title: 'Best sellers', tag: 'bestseller' },
]

export function starterCollections(sells: SellsWhat): { title: string; tag: string }[] {
  return [...STARTER_COLLECTIONS[sells], ...COMMON_COLLECTIONS]
}

/** Answers from the guided flow, sent with the store name and address when the store is created. */
export const BusinessProfileSchema = z.object({
  sells: z.enum(SELLS_WHAT),
  /** ISO 3166-1 alpha-2; India by default. */
  country: z.string().trim().length(2).toUpperCase().default('IN'),
  /** Indian state or union territory name (for GST); blank outside India. */
  state: z.string().trim().max(100).default(''),
  sellsOn: z.enum(SELLS_ON),
})
export type BusinessProfile = z.infer<typeof BusinessProfileSchema>
