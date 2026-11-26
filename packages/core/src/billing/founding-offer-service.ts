/** SOURCE OF TRUTH: founding offer, database side — WHAT a sign-up taking one of the 20 places (30-day trial) and a store's founding state (place + full founding months paid) / WHY the cap is counted across stores under one advisory lock, so two sign-ups at once never both take the last place */
import { planPayment, type StoreTx, storePlan } from '@commerce/db'
import { and, desc, eq, sql } from 'drizzle-orm'
import { canTakeFoundingPlace, FOUNDING_OFFER, type FoundingState } from './founding-offer'
import { TRIAL_DAYS } from './plans'

const DAY_MS = 86_400_000

type StorePlanRow = typeof storePlan.$inferSelect

/**
 * A new store's plan row, made at sign-up: a 30-day Growth trial and a founding place while the
 * offer is open and places are left, else the usual 14-day trial. A store that already has its
 * row (a retried sign-up, or one whose admin opened first) keeps it as it is.
 */
export async function startSignupPlan(
  tx: StoreTx,
  storeId: string,
  now = new Date(),
  open: boolean = FOUNDING_OFFER.open,
): Promise<StorePlanRow> {
  const read = () => tx.select().from(storePlan).where(eq(storePlan.storeId, storeId))
  const [found] = await read()
  if (found) return found
  // Held until this transaction ends: the count and the insert below are one step.
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext('founding_offer'))`)
  const rows = await tx.execute<{ n: number }>(sql`select founding_offer_taken() as n`)
  const founding = canTakeFoundingPlace(Number(rows[0]?.n ?? 0), open)
  const days = founding ? FOUNDING_OFFER.trialDays : TRIAL_DAYS
  await tx
    .insert(storePlan)
    .values({
      storeId,
      plan: 'growth',
      interval: 'month',
      status: 'trialing',
      trialEndsAt: new Date(now.getTime() + days * DAY_MS),
      foundingOfferAt: founding ? now : null,
    })
    .onConflictDoNothing({ target: storePlan.storeId })
  const [row] = await read()
  if (!row) throw new Error(`store_plan missing for ${storeId}`)
  return row
}

/** The store's place and how many full founding months it has paid. */
export async function loadFoundingState(tx: StoreTx, storeId: string): Promise<FoundingState> {
  const [row] = await tx
    .select({ at: storePlan.foundingOfferAt })
    .from(storePlan)
    .where(eq(storePlan.storeId, storeId))
  if (!row?.at) return { foundingOfferAt: null, monthsPaid: 0 }
  const [paid] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(planPayment)
    .where(
      and(
        eq(planPayment.storeId, storeId),
        eq(planPayment.foundingOffer, true),
        eq(planPayment.prorated, false),
        eq(planPayment.status, 'paid'),
      ),
    )
  return { foundingOfferAt: row.at, monthsPaid: paid?.n ?? 0 }
}

/** Whether the store's latest paid bill was at the founding price (a plan change credits it so). */
export async function lastPaidWasFounding(tx: StoreTx, storeId: string): Promise<boolean> {
  const [last] = await tx
    .select({ founding: planPayment.foundingOffer })
    .from(planPayment)
    .where(and(eq(planPayment.storeId, storeId), eq(planPayment.status, 'paid')))
    .orderBy(desc(planPayment.paidAt))
    .limit(1)
  return last?.founding ?? false
}
