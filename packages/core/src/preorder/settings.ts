import type { VariantPreorderOverride } from '@commerce/db'
import { z } from 'zod'
import { ownFields, type PreorderCampaignTerms } from './campaigns'

/**
 * Pre-order settings as stored on `product` (and optionally overridden per
 * variant via `variant.preorderOverride`). `full` charges the order total as
 * today; `fixed`/`percentage` compute a deposit due now and a balance due
 * later (see `computeDeposit`).
 */
export type PreorderPaymentMode = 'full' | 'fixed' | 'percentage'

export type PreorderSettings = {
  enabled: boolean
  /** Absolute ship date; takes priority over `shipsInDays` when both are set. */
  shipDate: Date | null
  shipsInDays: number | null
  /** Null = unlimited pre-order units beyond stock. */
  limit: number | null
  buttonLabel: string
  paymentMode: PreorderPaymentMode
  depositPaise: number | null
  depositPercent: number | null
  /** The campaign these settings came from (Products › Pre-orders); absent outside one. */
  campaignId?: string | null | undefined
}

export type ProductPreorderRow = {
  preorderEnabled: boolean
  preorderShipDate: Date | null
  preorderShipsInDays: number | null
  preorderLimit: number | null
  preorderButtonLabel: string
  preorderPaymentMode: PreorderPaymentMode
  preorderDepositPaise: number | null
  preorderDepositPercent: number | null
  /** In a campaign, the settings the product keeps its own (`PREORDER_OWN_FIELDS`). */
  preorderOwn?: readonly string[] | null | undefined
}

/**
 * A product in a campaign that applies: pre-order is on, and each setting comes from the
 * campaign unless the product keeps it as its own (`preorder_own`). A blank campaign button
 * text keeps the product's label.
 */
function campaignBase(product: ProductPreorderRow, c: PreorderCampaignTerms): PreorderSettings {
  const own = ownFields(product.preorderOwn)
  const keeps = (field: (typeof own)[number]) => own.includes(field)
  return {
    enabled: true,
    shipDate: keeps('shipping') ? product.preorderShipDate : c.shipDate,
    shipsInDays: keeps('shipping') ? product.preorderShipsInDays : c.shipsInDays,
    limit: keeps('limit') ? product.preorderLimit : c.limit,
    buttonLabel: keeps('button')
      ? product.preorderButtonLabel
      : c.content.buttonText?.trim() || product.preorderButtonLabel,
    paymentMode: keeps('payment') ? product.preorderPaymentMode : c.paymentMode,
    depositPaise: keeps('payment') ? product.preorderDepositPaise : c.depositPaise,
    depositPercent: keeps('payment') ? product.preorderDepositPercent : c.depositPercent,
    campaignId: c.id,
  }
}

/**
 * Merge a variant's override onto the product's settings; any key the
 * override leaves out inherits the product's value. `null` in the override
 * means "inherit" for the nullable fields, same as leaving the key out
 * (a variant override can only narrow or replace, never explicitly clear a
 * product-level date/limit while pre-order stays on).
 *
 * `enabled` only narrows: a variant sells on pre-order when the product has pre-order on AND
 * the variant allows it (`enabled: false` is the variant's "Allow pre-order" switch turned off,
 * Shopify's per-variant "Continue selling when out of stock"). A variant cannot switch pre-order
 * on for a product that has it off.
 *
 * Limit precedence, highest first: the variant's own `limit` (Variants › Edit › Pre-order
 * limit), then the campaign's limit unless the product keeps its own (`preorder_own` holds
 * 'limit'), then the product's `preorderLimit`. Every limit counts units sold past stock for
 * one variant; there is no product-wide total.
 */
export function resolvePreorderSettings(
  product: ProductPreorderRow,
  override?: VariantPreorderOverride | null,
  /** The product's campaign, only when it applies here (`campaignApplies`). */
  campaign?: PreorderCampaignTerms | null,
): PreorderSettings {
  const base: PreorderSettings = campaign
    ? campaignBase(product, campaign)
    : {
        enabled: product.preorderEnabled,
        shipDate: product.preorderShipDate,
        shipsInDays: product.preorderShipsInDays,
        limit: product.preorderLimit,
        buttonLabel: product.preorderButtonLabel,
        paymentMode: product.preorderPaymentMode,
        depositPaise: product.preorderDepositPaise,
        depositPercent: product.preorderDepositPercent,
      }
  if (!override) return base
  return {
    ...(base.campaignId ? { campaignId: base.campaignId } : {}),
    enabled: base.enabled && override.enabled !== false,
    shipDate: override.shipDate !== undefined ? parseDate(override.shipDate) : base.shipDate,
    shipsInDays: override.shipsInDays !== undefined ? override.shipsInDays : base.shipsInDays,
    // Null is "blank, use the product's (or campaign's)", as documented above, never "no limit".
    limit: override.limit ?? base.limit,
    buttonLabel: override.buttonLabel ?? base.buttonLabel,
    paymentMode: override.paymentMode ?? base.paymentMode,
    depositPaise: override.depositPaise !== undefined ? override.depositPaise : base.depositPaise,
    depositPercent:
      override.depositPercent !== undefined ? override.depositPercent : base.depositPercent,
  }
}

/** The variant's "Allow pre-order" switch: on unless its override turns it off (the default). */
export const variantAllowsPreorder = (override?: VariantPreorderOverride | null): boolean =>
  override?.enabled !== false

/**
 * The override to store for an "Allow pre-order" choice, keeping any other keys it holds.
 * Allowed drops the key (inherit the product); null when nothing is left to override.
 */
export function withPreorderAllowed(
  override: VariantPreorderOverride | null | undefined,
  allowed: boolean,
): VariantPreorderOverride | null {
  const { enabled: _enabled, ...rest } = override ?? {}
  const next: VariantPreorderOverride = allowed ? rest : { ...rest, enabled: false }
  return Object.keys(next).length > 0 ? next : null
}

/**
 * The override to store for a variant's own pre-order limit, keeping any other keys it holds.
 * Null (blank in the admin) drops the key, so the variant uses the product's or the campaign's
 * limit again; null overall when nothing is left to override.
 */
export function withPreorderLimit(
  override: VariantPreorderOverride | null | undefined,
  limit: number | null,
): VariantPreorderOverride | null {
  const { limit: _limit, ...rest } = override ?? {}
  const next: VariantPreorderOverride = limit == null ? rest : { ...rest, limit }
  return Object.keys(next).length > 0 ? next : null
}

/**
 * What a product save writes to `variant.preorder_override`: the stored override with the
 * fields the save sent applied on top (undefined leaves that key as it is), so keys the admin
 * does not edit survive. Undefined when the save sent neither, leaving the column alone.
 */
export function nextVariantPreorderOverride(
  current: VariantPreorderOverride | null | undefined,
  input: { preorderAllowed?: boolean | undefined; preorderLimit?: number | null | undefined },
): VariantPreorderOverride | null | undefined {
  if (input.preorderAllowed === undefined && input.preorderLimit === undefined) return undefined
  let next = current ?? null
  if (input.preorderAllowed !== undefined) next = withPreorderAllowed(next, input.preorderAllowed)
  if (input.preorderLimit !== undefined) next = withPreorderLimit(next, input.preorderLimit)
  return next
}

/** The variant's own pre-order limit, or null when it uses the product's (or campaign's). */
export const variantPreorderLimit = (override?: VariantPreorderOverride | null): number | null =>
  override?.limit ?? null

function parseDate(value: string | null): Date | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

/** The expected ship date to show and record, resolved from an absolute date or "ships in N days". */
export function resolveShipDate(settings: PreorderSettings, from: Date = new Date()): Date | null {
  if (settings.shipDate) return settings.shipDate
  if (settings.shipsInDays != null && settings.shipsInDays >= 0) {
    return new Date(from.getTime() + settings.shipsInDays * 24 * 60 * 60 * 1000)
  }
  return null
}

/** Product page / admin card validation: deposit must be a positive amount under the price, percent in 1-99. */
export const PreorderSettingsInputSchema = z
  .object({
    enabled: z.boolean(),
    shipDate: z.string().nullable(),
    shipsInDays: z.number().int().min(0).nullable(),
    limit: z.number().int().min(1).nullable(),
    buttonLabel: z.string().trim().min(1).max(60),
    paymentMode: z.enum(['full', 'fixed', 'percentage']),
    depositPaise: z.number().int().min(1).nullable(),
    depositPercent: z.number().int().min(1).max(99).nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.paymentMode === 'fixed' && (v.depositPaise == null || v.depositPaise < 1)) {
      ctx.addIssue({
        code: 'custom',
        path: ['depositPaise'],
        message: 'A fixed deposit needs an amount greater than zero',
      })
    }
    if (v.paymentMode === 'percentage' && (v.depositPercent == null || v.depositPercent < 1)) {
      ctx.addIssue({
        code: 'custom',
        path: ['depositPercent'],
        message: 'A percentage deposit needs a value between 1 and 99',
      })
    }
  })

/**
 * Validate a deposit amount against the variant's price: the deposit must be
 * strictly less than the price (otherwise there is nothing left to defer, and
 * "full" is the correct mode). Percent is validated by the schema (1-99); this
 * only re-checks the fixed-amount case, which depends on the price. A variant with no price yet
 * cannot be bought, so the comparison waits until it has one.
 */
export function validateDepositAgainstPrice(
  paymentMode: PreorderPaymentMode,
  depositPaise: number | null,
  pricePaise: number | null,
): string | null {
  if (paymentMode !== 'fixed') return null
  if (depositPaise == null) return 'A fixed deposit needs an amount'
  if (pricePaise != null && depositPaise >= pricePaise) {
    return 'The deposit must be less than the price'
  }
  return null
}
