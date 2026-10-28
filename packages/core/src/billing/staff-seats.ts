/** SOURCE OF TRUTH: staff seats — WHAT counts a store's team against its plan's staff accounts / WHY the owner's limits of 2026-10-28 (1 / 3 / 10 / 25, owner included) are enforced on invites */
import { authSchema, type StoreTx, storeInvitation, storeMember } from '@commerce/db'
import { and, count, eq } from 'drizzle-orm'
import { PLANS, type PlanId } from './plans'
import { ensureStorePlan } from './service'

export type StaffSeats = { plan: PlanId; used: number; limit: number }

/**
 * Active members (the owner too) plus open invitations, which hold a seat until they are
 * accepted or cancelled, so a store can't invite past its plan and accept later.
 */
export async function staffSeats(tx: StoreTx, storeId: string): Promise<StaffSeats> {
  const plan = await ensureStorePlan(tx, storeId)
  const [[members], [invites]] = await Promise.all([
    tx
      .select({ n: count() })
      .from(storeMember)
      .where(and(eq(storeMember.storeId, storeId), eq(storeMember.status, 'active'))),
    tx
      .select({ n: count() })
      .from(storeInvitation)
      .innerJoin(authSchema.invitation, eq(authSchema.invitation.id, storeInvitation.invitationId))
      .where(
        and(eq(storeInvitation.storeId, storeId), eq(authSchema.invitation.status, 'pending')),
      ),
  ])
  return {
    plan: plan.plan,
    used: (members?.n ?? 0) + (invites?.n ?? 0),
    limit: PLANS[plan.plan].staff,
  }
}
