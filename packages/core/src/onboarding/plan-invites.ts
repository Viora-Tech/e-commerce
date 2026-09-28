/** SOURCE OF TRUTH: platform plan sales to signup invites — WHAT: when an order on the platform's own sales store (PLATFORM_SALES_STORE_ID) is paid and contains a product tagged `platform-plan`, the buyer's email gets a signup invite, so they can sign in to the admin with that email and create their store / WHY: the platform sells its plans through one of its own stores, and signup is invite-only by default; without this someone has to run `bun run platform:invite` by hand after every sale */
import { type Db, order, orderLine, product, signupInvite, variant, withStore } from '@commerce/db'
import { and, eq, gt, isNull } from 'drizzle-orm'
import { createSignupInvite } from './signup-gate'

/** Tag a product with this on the sales store to make buying it grant a store. */
const PLATFORM_PLAN_TAG = 'platform-plan'

/** A plan buyer has a year to use their invite. */
const PLAN_INVITE_MS = 365 * 24 * 60 * 60 * 1000

export type PlanInviteResult =
  | { invited: true; email: string }
  | { invited: false; reason: 'not_sales_store' | 'no_plan' | 'no_email' | 'already_invited' }

/**
 * Run for every `order.paid` outbox row. Only the configured sales store counts, so no
 * other merchant can hand out platform invites by tagging a product. Safe to run twice
 * for the same order: a buyer with a live invite is left alone.
 */
export async function inviteForPaidPlanOrder(
  db: Db,
  input: { storeId: string; orderId: string; salesStoreId: string | undefined; now?: Date },
): Promise<PlanInviteResult> {
  if (!input.salesStoreId || input.storeId !== input.salesStoreId) {
    return { invited: false, reason: 'not_sales_store' }
  }
  const found = await withStore(db, input.storeId, async (tx) => {
    const [o] = await tx
      .select({ email: order.email })
      .from(order)
      .where(eq(order.id, input.orderId))
    const lines = await tx
      .select({ tags: product.tags })
      .from(orderLine)
      .innerJoin(variant, eq(variant.id, orderLine.variantId))
      .innerJoin(product, eq(product.id, variant.productId))
      .where(eq(orderLine.orderId, input.orderId))
    return {
      email: o?.email?.trim().toLowerCase() ?? null,
      plan: lines.some((l) => l.tags.includes(PLATFORM_PLAN_TAG)),
    }
  })
  if (!found.plan) return { invited: false, reason: 'no_plan' }
  if (!found.email?.includes('@')) return { invited: false, reason: 'no_email' }
  const now = input.now ?? new Date()
  const live = await db
    .select({ id: signupInvite.id })
    .from(signupInvite)
    .where(
      and(
        eq(signupInvite.email, found.email),
        isNull(signupInvite.usedAt),
        gt(signupInvite.expiresAt, now),
      ),
    )
  if (live.length > 0) return { invited: false, reason: 'already_invited' }
  await createSignupInvite(db, found.email, { expiresInMs: PLAN_INVITE_MS })
  return { invited: true, email: found.email }
}
