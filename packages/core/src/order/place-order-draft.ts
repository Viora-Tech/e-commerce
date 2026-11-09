/** SOURCE OF TRUTH: the checkout's draft decision — WHAT: `planCheckoutDraft` (is this checkout kept as a draft until paid, and on which open draft) and the `prepareDraft` step / WHY: split from place-order.ts so the workflow file stays readable; the rules live in payments/checkout-drafts.ts and order/checkout-draft.ts */
import { order } from '@commerce/db'
import { eq } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { checkoutDraftsOn, draftHoldMinutes, draftsForMethod } from '../payments/checkout-drafts'
import type { CheckoutContactKeys } from '../payments/manual-unpaid'
import type { PaymentSettings } from '../payments/settings'
import type { WorkflowStep } from '../workflow/run'
import {
  clearDraftForRetry,
  findSameItemsDraft,
  ORDERED_INSTEAD_NOTE,
  retireCheckoutDraft,
} from './checkout-draft'
import type { DraftPlan, PlaceOrderInput, RewriteTarget, State } from './place-order-types'

/**
 * Unpaid checkouts as drafts: an online or transfer checkout nothing else pays for is a draft
 * until paid. The same items again from the same shopper (email or phone), active within the
 * repeat window, go on their open draft: never a second draft, never a refusal (owner, 9 Nov
 * 2026). Cash on delivery (or cards paying it all) for the items of the shopper's open draft
 * closes that draft, giving its stock back. Null: an order at once.
 */
export async function planCheckoutDraft(
  ctx: StoreContext,
  input: PlaceOrderInput,
  opts: {
    contact: CheckoutContactKeys
    lines: readonly { variantId: string; quantity: number }[]
    payments: PaymentSettings
    /** The cart's own order written again with another way to pay (checkout-reopen.ts). */
    rewrite?: RewriteTarget | null | undefined
  },
): Promise<DraftPlan | null> {
  const method = input.paymentProvider.id
  const rewrite = opts.rewrite ?? null
  // A numbered order stays one; a draft stays this draft, or becomes the order (cash on delivery).
  if (rewrite && !rewrite.wasDraft) return null
  const sameItems = () =>
    findSameItemsDraft(ctx, {
      contact: opts.contact,
      lines: opts.lines,
      windowHours: opts.payments.duplicateCheckoutHours,
    })
  if (!draftsForMethod(method)) {
    if (rewrite) return null
    const open = await sameItems()
    if (open) await retireSameItemsDraft(ctx, open.id)
    return null
  }
  const asDraft =
    checkoutDraftsOn(opts.payments) && !input.giftCardIds?.length && !input.storeCredit
  if (!asDraft) return null
  const reuse = rewrite ? { id: rewrite.id, draftNumber: rewrite.draftNumber } : await sameItems()
  return { holdMinutes: draftHoldMinutes(opts.payments, method), reuse }
}

/** Close the shopper's open draft they just ordered another way. */
async function retireSameItemsDraft(ctx: StoreContext, id: string) {
  const [d] = await ctx.tx
    .select({ id: order.id, draftReserved: order.draftReserved })
    .from(order)
    .where(eq(order.id, id))
  if (!d) return
  await retireCheckoutDraft(ctx, d, {
    why: 'Ordered with cash on delivery instead',
    note: ORDERED_INSTEAD_NOTE,
  })
}

/**
 * The same items again on the shopper's open draft: its hold, discount uses, lines and
 * unanswered attempts go before stock is reserved, so the draft's own hold never refuses the
 * shopper's new try, and `createOrder` writes the draft again at today's prices and method.
 */
export const prepareDraft: WorkflowStep<State> = {
  name: 'prepareDraft',
  async run({ ctx, draft }) {
    if (draft?.reuse) await clearDraftForRetry(ctx, draft.reuse.id)
    return {}
  },
}
