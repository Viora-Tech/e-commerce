import type { VariantPreorderOverride } from '@commerce/db'
import { z } from 'zod'

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
 */
export function resolvePreorderSettings(
  product: ProductPreorderRow,
  override?: VariantPreorderOverride | null,
): PreorderSettings {
  const base: PreorderSettings = {
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
    enabled: base.enabled && override.enabled !== false,
    shipDate: override.shipDate !== undefined ? parseDate(override.shipDate) : base.shipDate,
    shipsInDays: override.shipsInDays !== undefined ? override.shipsInDays : base.shipsInDays,
    limit: override.limit !== undefined ? override.limit : base.limit,
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
