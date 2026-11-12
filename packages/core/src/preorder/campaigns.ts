/** SOURCE OF TRUTH: pre-order campaign rules (pure, client-safe)
 * WHAT:  What a campaign (Products › Pre-orders) decides for a product and a cart: which of its
 *        settings a product follows (`PREORDER_OWN_FIELDS`), whether it applies here (status,
 *        market, channel), the pre-order price after its discount, whether a line is a pre-order
 *        by stock, what a mixed cart may do, and the words and colours the storefront shows.
 * WHY:   addToCart, placeOrder, the storefront and the admin preview all ask the same questions;
 *        one answer each keeps them from drifting. The server enforces these, never only the UI.
 */
import type {
  PreorderCampaignChannel,
  PreorderCampaignContent,
  PreorderCampaignDesign,
  PreorderDiscountType,
  PreorderMixedCart,
  PreorderSoldOutInCart,
} from '@commerce/db'
import { z } from 'zod'
import type { PreorderPaymentMode } from './settings'

/** Settings a product in a campaign may keep its own instead of following the campaign. */
export const PREORDER_OWN_FIELDS = ['shipping', 'limit', 'button', 'payment', 'note'] as const
export type PreorderOwnField = (typeof PREORDER_OWN_FIELDS)[number]

export const MIXED_CART_RULES = ['together', 'split', 'block'] as const
export const SOLD_OUT_IN_CART_RULES = ['preorder', 'block'] as const
export const CAMPAIGN_CHANNELS = ['online_store', 'social', 'ai_agents'] as const
export const CAMPAIGN_DISCOUNT_TYPES = ['none', 'percentage', 'fixed'] as const

/** The most a percent pre-order discount may take off. */
export const MAX_DISCOUNT_PERCENT = 90

/** A campaign as the rules read it: the `preorder_campaign` row without its bookkeeping. */
export type PreorderCampaignTerms = {
  id: string
  name: string
  status: 'active' | 'paused'
  shipDate: Date | null
  shipsInDays: number | null
  limit: number | null
  paymentMode: PreorderPaymentMode
  depositPaise: number | null
  depositPercent: number | null
  discountType: PreorderDiscountType
  discountValue: number | null
  marketIds: string[]
  locationIds: string[]
  channels: PreorderCampaignChannel[]
  mixedCart: PreorderMixedCart
  soldOutInCart: PreorderSoldOutInCart
  content: PreorderCampaignContent
  design: PreorderCampaignDesign
}

/** Where the question is asked: the cart's market (null = primary) and the channel. */
export type CampaignPlace = {
  /** The market the shopper buys in; undefined when the caller does not know it (cards). */
  marketId?: string | null | undefined
  /** The store's primary market, which a cart without a market is in. */
  primaryMarketId?: string | null | undefined
  channel: PreorderCampaignChannel
}

/** The product's own-field list, cleaned of anything unknown (the column is free text). */
export function ownFields(value: readonly string[] | null | undefined): PreorderOwnField[] {
  return (value ?? []).filter((v): v is PreorderOwnField =>
    (PREORDER_OWN_FIELDS as readonly string[]).includes(v),
  )
}

/**
 * Whether a campaign applies here: active, selling in this channel, and in this market (an
 * empty market list is every market; a cart with no market is in the primary one). Callers that
 * do not know the market (product cards) pass `marketId: undefined` and get the market left out.
 */
export function campaignApplies(c: PreorderCampaignTerms | null | undefined, at: CampaignPlace) {
  if (c?.status !== 'active') return false
  if (!c.channels.includes(at.channel)) return false
  if (c.marketIds.length === 0 || at.marketId === undefined) return true
  const market = at.marketId ?? at.primaryMarketId ?? null
  return market !== null && c.marketIds.includes(market)
}

/**
 * One unit's price while it sells under the campaign: its percent or fixed amount off, never
 * below zero. Percent rounds to the nearest minor unit, like deposits.
 */
export function preorderUnitPrice(
  pricePaise: number,
  c: Pick<PreorderCampaignTerms, 'discountType' | 'discountValue'> | null | undefined,
): number {
  if (!c || c.discountType === 'none' || !c.discountValue || c.discountValue <= 0) {
    return pricePaise
  }
  if (c.discountType === 'percentage') {
    const pct = Math.min(c.discountValue, MAX_DISCOUNT_PERCENT)
    return Math.max(0, pricePaise - Math.round((pricePaise * pct) / 100))
  }
  return Math.max(0, pricePaise - c.discountValue)
}

/**
 * Whether a campaign line sells as a pre-order: only when the stock that counts for the
 * campaign cannot cover it. Untracked goods never run out, so they never pre-order under a
 * campaign. (Products outside campaigns keep the older rule: pre-order on is a pre-order.)
 */
export function campaignLineIsPreorder(input: {
  tracked: boolean
  available: number
  quantity: number
}): boolean {
  return input.tracked && input.available < input.quantity
}

/**
 * A line already in the cart at checkout: still a pre-order if it went in as one; else, when
 * the stock ran out meanwhile, a pre-order if the campaign turns it into one, and refused
 * (`block`) if not. `keep` is a line that still sells from stock.
 */
export function soldOutInCartOutcome(input: {
  wasPreorder: boolean
  soldOut: boolean
  rule: PreorderSoldOutInCart
}): 'preorder' | 'block' | 'keep' {
  if (input.wasPreorder) return 'preorder'
  if (!input.soldOut) return 'keep'
  return input.rule === 'preorder' ? 'preorder' : 'block'
}

/** One cart line as the mixed-cart rule reads it. */
export type MixedCartLine = {
  preorder: boolean
  giftCard?: boolean | undefined
  /** The campaign's rule for a pre-order line under one; null outside campaigns. */
  mixedCart: PreorderMixedCart | null
  /** The campaign's refusal text, for `block`. */
  blockMessage?: string | null | undefined
  campaignName?: string | null | undefined
}

export type MixedCartVerdict =
  | { kind: 'ok'; holdTogether: boolean }
  | { kind: 'blocked'; message: string | null; campaignName: string | null }

const STRICTNESS: Record<PreorderMixedCart, number> = { split: 0, together: 1, block: 2 }

/**
 * Pre-orders beside in-stock goods (gift cards aside): the strictest rule among the pre-order
 * lines' campaigns decides. `block` refuses the cart; `together` holds every parcel until the
 * pre-order ships; `split` (and pre-orders outside campaigns) ships what is in stock now.
 */
export function mixedCartVerdict(lines: readonly MixedCartLine[]): MixedCartVerdict {
  const goods = lines.filter((l) => !l.giftCard)
  const preorders = goods.filter((l) => l.preorder)
  const mixed = preorders.length > 0 && goods.some((l) => !l.preorder)
  if (!mixed) return { kind: 'ok', holdTogether: false }
  let strictest: MixedCartLine | null = null
  for (const l of preorders) {
    if (!l.mixedCart) continue
    if (!strictest?.mixedCart || STRICTNESS[l.mixedCart] > STRICTNESS[strictest.mixedCart]) {
      strictest = l
    }
  }
  if (strictest?.mixedCart === 'block') {
    return {
      kind: 'blocked',
      message: strictest.blockMessage?.trim() || null,
      campaignName: strictest.campaignName ?? null,
    }
  }
  return { kind: 'ok', holdTogether: strictest?.mixedCart === 'together' }
}

/** Where a pre-order note is shown; each place has its own campaign text. */
export type NotePlace = 'product' | 'cart' | 'order'

/**
 * The note text to fill in (before `preorderNoteText` adds the ship date): the product's own
 * when it keeps one, else the campaign's text for this place, else the product's note, else
 * null (the store's default then applies).
 */
export function campaignNoteSource(input: {
  productNote: string | null | undefined
  own: readonly string[] | null | undefined
  campaign: Pick<PreorderCampaignTerms, 'content'> | null | undefined
  place: NotePlace
}): string | null {
  const product = input.productNote?.trim() || null
  if (!input.campaign || ownFields(input.own).includes('note')) return product
  const c = input.campaign.content
  const text =
    input.place === 'product'
      ? c.productNote
      : input.place === 'cart'
        ? c.cartLineText
        : c.orderNote
  return text?.trim() || product
}

/** `#rrggbb` (or `#rgb`): the only colours a campaign stores. */
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

/** A campaign's colours with anything that is not a hex colour dropped (safe to put in a style). */
export function campaignColours(design: PreorderCampaignDesign | null | undefined) {
  const pick = (v: string | undefined) => (v && HEX.test(v.trim()) ? v.trim() : null)
  return {
    buttonBackground: pick(design?.buttonBackground),
    buttonText: pick(design?.buttonText),
    badgeBackground: pick(design?.badgeBackground),
    badgeText: pick(design?.badgeText),
  }
}
export type CampaignColours = ReturnType<typeof campaignColours>

const text = (max: number) => z.string().trim().max(max).optional()
const hex = z
  .string()
  .trim()
  .regex(HEX, 'Use a colour like #1a1a1a')
  .optional()
  .or(z.literal('').transform(() => undefined))

export const PreorderCampaignContentSchema = z.object({
  buttonText: text(60),
  badgeText: text(40),
  productNote: text(500),
  cartLineText: text(500),
  orderNote: text(500),
  blockMessage: text(300),
})

export const PreorderCampaignDesignSchema = z.object({
  buttonBackground: hex,
  buttonText: hex,
  badgeBackground: hex,
  badgeText: hex,
})

const campaignFields = {
  name: z.string().trim().min(1, 'Give the campaign a name').max(80),
  status: z.enum(['active', 'paused']),
  shipDate: z.coerce.date().nullable(),
  shipsInDays: z.number().int().min(0).max(3650).nullable(),
  limit: z.number().int().min(1).max(1_000_000).nullable(),
  paymentMode: z.enum(['full', 'fixed', 'percentage']),
  depositPaise: z.number().int().min(1).nullable(),
  depositPercent: z.number().int().min(1).max(99).nullable(),
  discountType: z.enum(CAMPAIGN_DISCOUNT_TYPES),
  discountValue: z.number().int().min(1).nullable(),
  marketIds: z.array(z.uuid()).max(200),
  locationIds: z.array(z.uuid()).max(200),
  channels: z.array(z.enum(CAMPAIGN_CHANNELS)).max(CAMPAIGN_CHANNELS.length),
  mixedCart: z.enum(MIXED_CART_RULES),
  soldOutInCart: z.enum(SOLD_OUT_IN_CART_RULES),
  content: PreorderCampaignContentSchema,
  design: PreorderCampaignDesignSchema,
  /** The products in the campaign; each leaves the campaign it was in. */
  productIds: z.array(z.uuid()).max(5000),
  /**
   * Per product (#1473): which variants take pre-orders (null: all of them) and its own limit
   * beyond stock (null: the campaign's). A product left out keeps what it had.
   */
  members: z
    .array(
      z.object({
        productId: z.uuid(),
        variantIds: z.array(z.uuid()).max(500).nullable(),
        limit: z.number().int().min(0).max(1_000_000).nullable(),
      }),
    )
    .max(5000),
  /**
   * Each variant's own pre-order limit, typed on the campaign page and stored on the variant
   * (`preorder_override.limit`, the field its page edits). Null clears it: the variant uses its
   * product's limit, or the campaign's. Only variants of the campaign's products change.
   */
  variantLimits: z
    .array(
      z.object({
        variantId: z.uuid(),
        limit: z.number().int().min(1).max(1_000_000).nullable(),
      }),
    )
    .max(5000),
}

type CampaignShape = {
  paymentMode?: PreorderPaymentMode | undefined
  depositPaise?: number | null | undefined
  depositPercent?: number | null | undefined
  discountType?: PreorderDiscountType | undefined
  discountValue?: number | null | undefined
}

/** The checks a deposit and a discount need beyond their own field (shared by create and update). */
function checkMoney(v: CampaignShape, ctx: z.RefinementCtx) {
  if (v.paymentMode === 'fixed' && !v.depositPaise) {
    ctx.addIssue({
      code: 'custom',
      path: ['depositPaise'],
      message: 'A fixed deposit needs an amount',
    })
  }
  if (v.paymentMode === 'percentage' && !v.depositPercent) {
    ctx.addIssue({
      code: 'custom',
      path: ['depositPercent'],
      message: 'A percentage deposit needs a value between 1 and 99',
    })
  }
  if (v.discountType && v.discountType !== 'none' && !v.discountValue) {
    ctx.addIssue({ code: 'custom', path: ['discountValue'], message: 'Set how much is off' })
  }
  if (v.discountType === 'percentage' && (v.discountValue ?? 0) > MAX_DISCOUNT_PERCENT) {
    ctx.addIssue({
      code: 'custom',
      path: ['discountValue'],
      message: `A pre-order discount is at most ${MAX_DISCOUNT_PERCENT}%`,
    })
  }
}

export const PreorderCampaignCreateSchema = z
  .object({
    name: campaignFields.name,
    status: campaignFields.status.default('active'),
    shipDate: campaignFields.shipDate.default(null),
    shipsInDays: campaignFields.shipsInDays.default(null),
    limit: campaignFields.limit.default(null),
    paymentMode: campaignFields.paymentMode.default('full'),
    depositPaise: campaignFields.depositPaise.default(null),
    depositPercent: campaignFields.depositPercent.default(null),
    discountType: campaignFields.discountType.default('none'),
    discountValue: campaignFields.discountValue.default(null),
    marketIds: campaignFields.marketIds.default([]),
    locationIds: campaignFields.locationIds.default([]),
    channels: campaignFields.channels.default([...CAMPAIGN_CHANNELS]),
    mixedCart: campaignFields.mixedCart.default('split'),
    soldOutInCart: campaignFields.soldOutInCart.default('preorder'),
    content: campaignFields.content.default({}),
    design: campaignFields.design.default({}),
    productIds: campaignFields.productIds.default([]),
    members: campaignFields.members.default([]),
    variantLimits: campaignFields.variantLimits.default([]),
  })
  .superRefine(checkMoney)
export type PreorderCampaignCreateInput = z.input<typeof PreorderCampaignCreateSchema>

/** Only the fields sent change. */
export const PreorderCampaignUpdateSchema = z
  .object({
    id: z.uuid(),
    name: campaignFields.name.optional(),
    status: campaignFields.status.optional(),
    shipDate: campaignFields.shipDate.optional(),
    shipsInDays: campaignFields.shipsInDays.optional(),
    limit: campaignFields.limit.optional(),
    paymentMode: campaignFields.paymentMode.optional(),
    depositPaise: campaignFields.depositPaise.optional(),
    depositPercent: campaignFields.depositPercent.optional(),
    discountType: campaignFields.discountType.optional(),
    discountValue: campaignFields.discountValue.optional(),
    marketIds: campaignFields.marketIds.optional(),
    locationIds: campaignFields.locationIds.optional(),
    channels: campaignFields.channels.optional(),
    mixedCart: campaignFields.mixedCart.optional(),
    soldOutInCart: campaignFields.soldOutInCart.optional(),
    content: campaignFields.content.optional(),
    design: campaignFields.design.optional(),
    productIds: campaignFields.productIds.optional(),
    members: campaignFields.members.optional(),
    variantLimits: campaignFields.variantLimits.optional(),
  })
  .superRefine(checkMoney)
export type PreorderCampaignUpdateInput = z.input<typeof PreorderCampaignUpdateSchema>
export type PreorderCampaignMember = z.infer<typeof campaignFields.members>[number]
export type PreorderCampaignVariantLimit = z.infer<typeof campaignFields.variantLimits>[number]

/** The products whose variants the campaign page lists (saved members and ones just picked). */
export const PreorderCampaignVariantsSchema = z.object({
  productIds: z.array(z.uuid()).max(5000),
})

export const PreorderCampaignIdSchema = z.object({ id: z.uuid() })
