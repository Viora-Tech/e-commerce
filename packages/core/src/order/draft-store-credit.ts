/** SOURCE OF TRUTH: store credit on admin draft orders — WHAT: applying part or all of the draft customer's store credit balance to a draft, and spending it when the draft becomes an order / WHY: staff building an order for a customer can use the money the shop owes them, without ever taking it twice or losing it when the draft is changed or deleted */

import { payment } from '@commerce/db'
import { formatMoney } from '@commerce/money'
import { and, eq } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { changeStoreCredit, StoreCreditError } from '../customers/store-credit'
import { lockStoreCreditBalance, spendableStoreCredit } from '../customers/store-credit-expiry'
import { CommerceError } from '../errors'
import { STORE_CREDIT_PROVIDER } from '../payments/split-tender'

/*
 * How store credit pays for a draft order:
 *
 * - "Apply store credit" on the draft records the amount as a `store_credit` payment row in
 *   status `created` (recorded, nothing taken yet), with the customer in `provider_payment_id`.
 *   Nothing leaves the balance while it is a draft, so editing, releasing or deleting the draft
 *   can never lose credit (the delete removes the row with the draft's other unfinished payments).
 * - Saving checks the amount: a customer is picked, it is at most the draft's total and, when
 *   staff typed a new amount, at most the customer's balance right now. Saving the same amount
 *   again (an unrelated edit after the balance fell) keeps it: the convert caps it.
 * - Converting takes it, in the convert's transaction: the account row is locked, the ledger
 *   gets a `payment` line linked to the order, and the same payment row becomes `captured`
 *   (staff convert) or `pending` (the customer pays the rest online from the invoice: a hold,
 *   captured with the gateway payment or given back if the order is cancelled unpaid, as at
 *   checkout). A balance that fell below the amount since the draft was saved is not a refusal:
 *   the convert takes what the balance holds now (nothing when it is empty, and the row goes),
 *   and the chosen method collects the rest. The draft row is locked by the convert, so a second
 *   convert waits and then finds an order, never a draft: the credit is taken once.
 *
 * Store credit is a payment, not a discount: the draft's total and GST never change with it.
 */

/** Store credit covers the whole draft, so its invoice has nothing to pay online. */
export class DraftPaidByStoreCredit extends CommerceError {
  constructor(storeId?: string) {
    super(
      'DRAFT_PAID_BY_STORE_CREDIT',
      'Store credit pays all of this draft, so there is nothing to pay online. Convert it to an order instead.',
      { storeId },
    )
  }
}

/** The applied row's reference while it is a draft; it takes checkout's reference on convert. */
const draftRef = (orderId: string) => `store_credit_draft_${orderId}`

export type DraftStoreCredit = { paymentId: string; customerId: string; amountPaise: number }

const rupees = (paise: number) => formatMoney(paise, 'INR')

/** The store credit applied to a draft and not yet taken; null when none is applied. */
export async function draftStoreCredit(
  ctx: StoreContext,
  orderId: string,
): Promise<DraftStoreCredit | null> {
  const [row] = await ctx.tx
    .select({
      paymentId: payment.id,
      customerId: payment.providerPaymentId,
      amountPaise: payment.amountPaise,
    })
    .from(payment)
    .where(
      and(
        eq(payment.orderId, orderId),
        eq(payment.provider, STORE_CREDIT_PROVIDER),
        eq(payment.status, 'created'),
      ),
    )
  return row?.customerId ? { ...row, customerId: row.customerId } : null
}

/**
 * The customer's spendable balance now (expired credit left out), locked when `lock` (the
 * convert, which also writes the expiry lines), else just read (a save).
 */
async function balanceOf(ctx: StoreContext, customerId: string, lock: boolean): Promise<number> {
  return lock ? lockStoreCreditBalance(ctx, customerId) : spendableStoreCredit(ctx, customerId)
}

/** The amount a convert would take now: what was applied, capped at the balance today. */
export async function draftStoreCreditDue(ctx: StoreContext, orderId: string): Promise<number> {
  const applied = await draftStoreCredit(ctx, orderId)
  if (!applied) return 0
  return Math.min(applied.amountPaise, await balanceOf(ctx, applied.customerId, false))
}

/**
 * Apply (or change, or with 0 remove) the store credit on a draft. Checks the amount against the
 * draft's customer, its total and (for a new amount) the customer's balance now; takes nothing
 * from the balance.
 */
export async function setDraftStoreCredit(
  ctx: StoreContext,
  input: { orderId: string; customerId: string | null; amountPaise: number; totalPaise: number },
): Promise<void> {
  const amount = input.amountPaise
  if (!Number.isInteger(amount) || amount < 0) {
    throw new StoreCreditError('invalid', 'Enter the store credit in rupees.', ctx.storeId)
  }
  const before = await draftStoreCredit(ctx, input.orderId)
  await ctx.tx
    .delete(payment)
    .where(
      and(
        eq(payment.orderId, input.orderId),
        eq(payment.provider, STORE_CREDIT_PROVIDER),
        eq(payment.status, 'created'),
      ),
    )
  if (amount === 0) return
  if (!input.customerId) {
    throw new StoreCreditError(
      'invalid',
      'Pick a customer to use their store credit on this draft.',
      ctx.storeId,
    )
  }
  if (amount > input.totalPaise) {
    throw new StoreCreditError(
      'invalid',
      `Store credit cannot be more than the draft's total (${rupees(input.totalPaise)}).`,
      ctx.storeId,
    )
  }
  // The same amount for the same customer is kept even if the balance fell: the convert caps it.
  const unchanged = before?.customerId === input.customerId && before.amountPaise === amount
  const balance = unchanged ? amount : await balanceOf(ctx, input.customerId, false)
  if (amount > balance) {
    throw new StoreCreditError(
      'insufficient',
      `The customer has ${rupees(balance)} in store credit, less than the ${rupees(amount)} applied.`,
      ctx.storeId,
    )
  }
  await ctx.tx.insert(payment).values({
    storeId: ctx.storeId,
    orderId: input.orderId,
    provider: STORE_CREDIT_PROVIDER,
    providerRef: draftRef(input.orderId),
    providerPaymentId: input.customerId,
    status: 'created',
    amountPaise: amount,
  })
}

/**
 * The draft is becoming an order: take its applied store credit from the customer's balance
 * (ledger line linked to the order) and turn its payment row into the order's store credit
 * payment, `captured`, or `pending` when `hold` (the gateway pays the rest). A balance that fell
 * since it was applied caps what is taken; an empty one takes nothing and drops the row. Returns
 * the amount taken, 0 with none. Runs in the convert's transaction, so a refusal changes nothing.
 */
export async function spendDraftStoreCredit(
  ctx: StoreContext,
  input: { orderId: string; orderNumber: number; customerId: string | null; hold: boolean },
): Promise<number> {
  const applied = await draftStoreCredit(ctx, input.orderId)
  if (!applied) return 0
  if (input.customerId !== applied.customerId) {
    throw new StoreCreditError(
      'invalid',
      "The draft's customer changed after store credit was applied. Apply it again and save.",
      ctx.storeId,
    )
  }
  // The row lock: a checkout or another convert for this customer waits here, then sees the
  // balance that one left, so the two can never spend the same rupee.
  const balance = await balanceOf(ctx, applied.customerId, true)
  const take = Math.min(applied.amountPaise, Math.max(0, balance))
  if (take === 0) {
    await ctx.tx.delete(payment).where(eq(payment.id, applied.paymentId))
    return 0
  }
  await changeStoreCredit(ctx, {
    customerId: applied.customerId,
    amountPaise: -take,
    kind: 'payment',
    reason: `Used on order #${input.orderNumber}`,
    orderId: input.orderId,
  })
  const taken = await ctx.tx
    .update(payment)
    .set({
      status: input.hold ? 'pending' : 'captured',
      amountPaise: take,
      providerRef: `store_credit_${input.orderId}`,
    })
    .where(and(eq(payment.id, applied.paymentId), eq(payment.status, 'created')))
    .returning({ id: payment.id })
  if (taken.length !== 1) throw new Error('draft store credit payment changed during convert')
  return take
}
