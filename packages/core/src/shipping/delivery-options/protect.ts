/** SOURCE OF TRUTH: Delhivery Protect's insurance fee — WHAT: the merchant's Protect card (rates
 * per category, product-type overrides; defaults when nothing is saved), a parcel's category
 * (one category, else Multi-category; nothing known, Undetermined) and its fee, ceil(value ×
 * rate) in paise / WHY: Delhivery's rate API returns no insurance price, so the courier drawer,
 * checkout pricing, the booked shipment and the shipping margin all read this one card. Pure,
 * browser-safe (`@commerce/core/delhivery-protect`).
 */
import { z } from 'zod'
import {
  DEFAULT_PROTECT_BPS,
  PROTECT_CATEGORIES,
  type ProtectCategory,
  taxonomyProtectCategory,
  typeProtectCategory,
} from './protect-categories'

export * from './protect-categories'

const category = z.enum(PROTECT_CATEGORIES)
/** Basis points: 25 is 0.25%. Up to 10%. */
const bps = z.number().int().min(0).max(1000)

/**
 * Saved in `store.apps.settings['delivery-options'].protect`. `ratesBps` holds only the rates
 * the merchant changed; `typeOverrides` sends a product type to a category ("Glasspads" →
 * Computers, Laptops and Accessories) whatever its taxonomy category says.
 */
/** Couriers whose insurance terms the app knows (owner, 12 Nov 2026), by their app id. */
export const INSURED_COURIERS = ['delhivery', 'shiprocket', 'rapidshyp'] as const
export type InsuredCourier = (typeof INSURED_COURIERS)[number]

const coverPaise = z.number().int().min(0).max(1_000_000_000)

/** Each field unset uses the courier's default (`DEFAULT_COURIER_COVER`). */
export const CourierCoverSchema = z.object({
  /** The most the insurance pays for one shipment. */
  coverCapPaise: coverPaise.optional(),
  /** The most the courier refunds for a lost shipment sent without insurance. */
  uninsuredLimitPaise: coverPaise.optional(),
  /** Glass and other fragile goods are covered. */
  coversFragile: z.boolean().optional(),
  /** Second-hand, used, refurbished and open-box goods are not covered. */
  excludesUsed: z.boolean().optional(),
  /** The excess taken off every claim, in basis points of the claim (50 is 0.5%). */
  deductibleBps: z.number().int().min(0).max(10_000).optional(),
})

/** A courier's insurance terms; null where they are not known (never blocks, never warns). */
export type CourierCover = {
  coverCapPaise: number | null
  uninsuredLimitPaise: number | null
  coversFragile: boolean | null
  excludesUsed: boolean | null
  deductibleBps: number | null
}

const UNKNOWN_COVER: CourierCover = {
  coverCapPaise: null,
  uninsuredLimitPaise: null,
  coversFragile: null,
  excludesUsed: null,
  deductibleBps: null,
}

/**
 * Each courier's cover, as the owner confirmed it (12 Nov 2026). Delhivery Protect: the declared
 * value up to ₹30,000 (Delhivery's help page). Shiprocket (its policy text): up to ₹4,75,000 per
 * shipment insured, ₹2,500 at most without; fragile goods covered; used, refurbished and
 * open-box goods not; a 0.5% excess on claims. Delhivery Protect: glass not excluded (it is
 * not offered on returns, replacements or BFSI/documents, which Create shipment never books);
 * its uninsured limit is not known. RapidShyp (ToS 8.1, every courier but India Post): ₹2,500
 * at most without insurance (or the order value, if lower); its insured cap is not known.
 */
export const DEFAULT_COURIER_COVER: Readonly<Record<InsuredCourier, CourierCover>> = {
  delhivery: { ...UNKNOWN_COVER, coverCapPaise: 3_000_000, coversFragile: true },
  shiprocket: {
    coverCapPaise: 47_500_000,
    uninsuredLimitPaise: 250_000,
    coversFragile: true,
    excludesUsed: true,
    deductibleBps: 50,
  },
  rapidshyp: { ...UNKNOWN_COVER, uninsuredLimitPaise: 250_000 },
}

export const ProtectCardSchema = z.object({
  ratesBps: z.partialRecord(category, bps).default({}),
  typeOverrides: z
    .array(z.object({ productType: z.string().trim().min(1).max(120), category }))
    .max(100)
    .default([]),
  /** The merchant's own cover cap and uninsured limit per courier, where they differ. */
  couriers: z.partialRecord(z.enum(INSURED_COURIERS), CourierCoverSchema).default({}),
})
export type ProtectCard = z.infer<typeof ProtectCardSchema>

export const DEFAULT_PROTECT_CARD: ProtectCard = { ratesBps: {}, typeOverrides: [], couriers: {} }

/** A courier's cover cap and uninsured limit: the merchant's, else the default, else unknown. */
export function courierCover(providerId: string, card: ProtectCard): CourierCover {
  const known = (INSURED_COURIERS as readonly string[]).includes(providerId)
    ? (providerId as InsuredCourier)
    : null
  const own = known ? card.couriers?.[known] : undefined
  const base = known ? DEFAULT_COURIER_COVER[known] : UNKNOWN_COVER
  return {
    coverCapPaise: own?.coverCapPaise ?? base.coverCapPaise,
    uninsuredLimitPaise: own?.uninsuredLimitPaise ?? base.uninsuredLimitPaise,
    coversFragile: own?.coversFragile ?? base.coversFragile,
    excludesUsed: own?.excludesUsed ?? base.excludesUsed,
    deductibleBps: own?.deductibleBps ?? base.deductibleBps,
  }
}

const USED_TAGS = new Set(['open-box', 'open box', 'openbox', 'used', 'refurbished', 'second-hand'])

/**
 * A used, refurbished or open-box product, which some insurers do not cover (Shiprocket): a tag
 * like `open-box`, or a title starting "[OPEN BOX]" (how Waimers names them). The one place to
 * move to a product field later.
 */
export function isUsedProduct(p: {
  title?: string | null | undefined
  tags?: readonly string[] | null | undefined
}): boolean {
  if (p.tags?.some((t) => USED_TAGS.has(t.trim().toLowerCase()))) return true
  return /^\s*\[\s*open[\s-]*box\s*\]/i.test(p.title ?? '')
}

/** What a parcel worth `valuePaise` is covered for: all of it, or the cap when lower. */
export const coveredPaise = (valuePaise: number, capPaise: number | null): number =>
  capPaise === null ? valuePaise : Math.min(valuePaise, capPaise)

/** A saved card, or the defaults when it is missing or no longer valid. */
export function parseProtectCard(raw: unknown): ProtectCard {
  const parsed = ProtectCardSchema.safeParse(raw ?? {})
  return parsed.success ? parsed.data : DEFAULT_PROTECT_CARD
}

/** What a product says about itself: its taxonomy category and its product type. */
export type ProtectItem = {
  categoryId?: string | null | undefined
  productType?: string | null | undefined
}

const lower = (s: string) => s.trim().toLowerCase()

/** One product's category: the merchant's type override, its taxonomy category, its type's
 *  words, else Undetermined. */
export function itemProtectCategory(item: ProtectItem, card: ProtectCard): ProtectCategory {
  const type = item.productType ? lower(item.productType) : ''
  const override = type ? card.typeOverrides.find((o) => lower(o.productType) === type) : undefined
  return (
    override?.category ??
    taxonomyProtectCategory(item.categoryId) ??
    typeProtectCategory(item.productType) ??
    'undetermined'
  )
}

/** A parcel's category: its products' one category, Multi-category for two or more, and
 *  Undetermined when nothing is known about its products. */
export function parcelProtectCategory(
  items: readonly ProtectItem[],
  card: ProtectCard,
): ProtectCategory {
  const found = new Set(items.map((i) => itemProtectCategory(i, card)))
  if (found.size === 0) return 'undetermined'
  if (found.size > 1) return 'multi'
  return [...found][0] as ProtectCategory
}

/** The rate for a category on this card: the merchant's, else Delhivery's default. */
export const protectRateBps = (cat: ProtectCategory, card: ProtectCard): number =>
  card.ratesBps[cat] ?? DEFAULT_PROTECT_BPS[cat]

/** GST couriers add on the insurance fee: 18% (owner's Delhivery and RapidShyp quotes, 12 Nov). */
export const INSURANCE_GST_BPS = 1800

/**
 * Declared value × rate, rounded to the paisa as Delhivery does, before its 18% GST (added by
 * `insuranceQuote`): ₹10,000 at 0.30% is ₹30; ₹4,699 at 0.40% is ₹18.796, so ₹18.80.
 */
export const protectFeePaise = (valuePaise: number, rateBps: number): number =>
  Math.round((Math.max(0, valuePaise) * rateBps) / 10_000)

export type ProtectQuote = { category: ProtectCategory; bps: number }

/** The category and rate Delhivery Protect prices this parcel's products at. */
export function parcelProtect(items: readonly ProtectItem[], card: ProtectCard): ProtectQuote {
  const cat = parcelProtectCategory(items, card)
  return { category: cat, bps: protectRateBps(cat, card) }
}
