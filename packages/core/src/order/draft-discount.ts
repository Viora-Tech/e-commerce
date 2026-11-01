/** SOURCE OF TRUTH: discount codes on admin draft orders — WHAT: checks a store discount code against a draft's lines with checkout's evaluator, and prices the draft with it / WHY: a phone or WhatsApp order must honour the same codes, limits and eligibility as the storefront */
import { product, variant } from '@commerce/db'
import { eq, inArray } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { applyDiscount, normaliseCode } from '../discounts/evaluate'
import { type CodeRejection, checkCodeOn, withCollections } from '../discounts/resolve'
import { CommerceError } from '../errors'
import type { DraftInput } from './drafts'

export type DraftCodeLine = {
  /** Absent on a custom item: it counts toward order-wide codes, never product-scoped ones. */
  variantId?: string | undefined
  quantity: number
  /** The draft's price for the line; blank reads the catalogue price. */
  unitPricePaise?: number | undefined
}

export type DraftCodeInput = {
  code: string
  lines: DraftCodeLine[]
  /** The draft's email: per-customer caps and customer eligibility key on it. */
  email?: string | null | undefined
  /** The shipping address's state, for free shipping limited to states. */
  stateCode?: string | null | undefined
  /** The draft's shipping charge, which a free-shipping code may waive. */
  shippingPaise?: number | undefined
}

export type DraftCodeResult =
  | {
      ok: true
      discountId: string
      code: string
      label: string
      /** Taken off the subtotal (0 for a free-shipping code). */
      amountPaise: number
      freeShipping: boolean
      /** The shipping charge after the code: 0 when it waives the draft's rate. */
      shippingPaise: number
    }
  | { ok: false; code: string; reason: CodeRejection }

/** A draft saved with a code that no longer applies. The message is shown as is. */
class DraftDiscountRejected extends CommerceError {
  constructor(code: string, reason: CodeRejection, storeId?: string) {
    super('DRAFT_DISCOUNT_REJECTED', `${code}: ${REJECTION_TEXT[reason]}`, { storeId })
  }
}

const REJECTION_TEXT: Record<CodeRejection, string> = {
  invalid: 'this code does not exist or is not active',
  not_applicable: 'this code does not apply to these products',
  min_subtotal: 'the order is below the minimum for this code',
  min_quantity: 'the order has fewer items than this code needs',
  not_eligible: 'this customer is not eligible for this code',
  first_order_only: 'this code is for first-time buyers, and this customer has ordered before',
  limit_reached: 'this code has reached its usage limit',
}

/**
 * Check a typed code against a draft's lines, exactly as checkout checks it against a cart:
 * dates, status, minimums, product and collection scope, customer eligibility and the
 * per-customer cap for the draft's email. A draft with a gift card takes no code, as at
 * checkout, so a code can never buy store credit at a discount.
 */
export async function checkDraftDiscountCode(
  ctx: StoreContext,
  input: DraftCodeInput,
): Promise<DraftCodeResult> {
  const code = normaliseCode(input.code)
  const shippingPaise = input.shippingPaise ?? 0
  const ids = [...new Set(input.lines.flatMap((l) => (l.variantId ? [l.variantId] : [])))]
  const rows =
    ids.length === 0
      ? []
      : await ctx.tx
          .select({
            id: variant.id,
            productId: variant.productId,
            pricePaise: variant.pricePaise,
            giftCard: product.isGiftCard,
          })
          .from(variant)
          .innerJoin(product, eq(product.id, variant.productId))
          .where(inArray(variant.id, ids))
  const byId = new Map(rows.map((r) => [r.id, r]))
  if (rows.some((r) => r.giftCard)) return { ok: false, code, reason: 'not_applicable' }
  const lines = input.lines.flatMap((l) => {
    if (!l.variantId) {
      // A custom item belongs to no product or collection, so only order-wide codes see it.
      return [
        {
          productId: CUSTOM_LINE_PRODUCT,
          quantity: l.quantity,
          unitPricePaise: l.unitPricePaise ?? 0,
        },
      ]
    }
    const v = byId.get(l.variantId)
    return v
      ? [
          {
            productId: v.productId,
            variantId: l.variantId,
            quantity: l.quantity,
            // No price yet (#913) counts as nothing until the line is given one.
            unitPricePaise: l.unitPricePaise ?? v.pricePaise ?? 0,
          },
        ]
      : []
  })
  const check = await checkCodeOn(ctx, () => withCollections(ctx, lines, shippingPaise), code, {
    email: input.email,
    stateCode: input.stateCode,
  })
  if (!check.ok) return { ok: false, code, reason: check.reason }
  const subtotal = lines.reduce((sum, l) => sum + l.quantity * l.unitPricePaise, 0)
  const priced = applyDiscount(subtotal, shippingPaise, check.outcome)
  return {
    ok: true,
    discountId: check.outcome.discount.id,
    code,
    label: check.outcome.label,
    amountPaise: priced.discountPaise,
    freeShipping: check.outcome.freeShipping,
    shippingPaise: priced.shippingPaise,
  }
}

/** Stands in for a custom item's product while checking a code: in no collection, matches no product. */
const CUSTOM_LINE_PRODUCT = '00000000-0000-0000-0000-000000000000'

const sumPaise = (lines: { quantity: number; unitPricePaise: number }[]) =>
  lines.reduce((sum, l) => sum + l.quantity * l.unitPricePaise, 0)

/**
 * A draft's money as it saves. A discount code is checked again on every save, with checkout's
 * rules, and replaces the manual discount: the two never stack, because the manual amount is
 * not a discount rule the combinations model could weigh. A code that stopped applying (a
 * line removed, the customer changed) refuses the save with the reason.
 */
export async function draftMoney(
  ctx: StoreContext,
  lines: { variantId: string; quantity: number; unitPricePaise: number }[],
  input: DraftInput,
) {
  const subtotalPaise = sumPaise(lines)
  const code = input.discountCode?.trim()
  if (code) {
    const check = await checkDraftDiscountCode(ctx, {
      code,
      lines,
      email: input.email,
      stateCode: input.shipping?.stateCode ?? null,
      shippingPaise: input.shippingPaise,
    })
    if (!check.ok) throw new DraftDiscountRejected(check.code, check.reason, ctx.storeId)
    return {
      subtotalPaise,
      discountId: check.discountId,
      discountCode: check.code,
      discountLabel: check.label,
      discountPaise: check.amountPaise,
      shippingPaise: check.shippingPaise,
      totalPaise: subtotalPaise - check.amountPaise + check.shippingPaise,
    }
  }
  const discountPaise = Math.min(input.discountPaise, subtotalPaise)
  return {
    subtotalPaise,
    discountId: null,
    discountCode: null,
    discountLabel: input.discountLabel ?? null,
    discountPaise,
    shippingPaise: input.shippingPaise,
    totalPaise: subtotalPaise - discountPaise + input.shippingPaise,
  }
}
