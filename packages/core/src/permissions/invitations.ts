import type { StoreTx } from '@commerce/db'
import { authSchema, storeInvitation } from '@commerce/db'
import { and, desc, eq } from 'drizzle-orm'

const normalise = (email: string) => email.trim().toLowerCase()

/** Remembers the store role a Better Auth invitation grants, until it is accepted. */
export async function recordInvitationRole(
  tx: StoreTx,
  input: {
    storeId: string
    invitationId: string
    email: string
    roleId: string
    invitedBy: string | null
  },
): Promise<void> {
  await tx
    .insert(storeInvitation)
    .values({
      storeId: input.storeId,
      invitationId: input.invitationId,
      email: normalise(input.email),
      roleId: input.roleId,
      invitedBy: input.invitedBy,
    })
    .onConflictDoUpdate({
      target: storeInvitation.invitationId,
      set: { roleId: input.roleId, email: normalise(input.email) },
    })
}

/** The role one invitation grants in this store, or null when it was never recorded. */
export async function invitationRole(
  tx: StoreTx,
  storeId: string,
  invitationId: string,
): Promise<string | null> {
  const rows = await tx
    .select({ roleId: storeInvitation.roleId })
    .from(storeInvitation)
    .where(
      and(eq(storeInvitation.storeId, storeId), eq(storeInvitation.invitationId, invitationId)),
    )
  return rows[0]?.roleId ?? null
}

/**
 * The role the newest invitation to this user's email grants in this store.
 * Used when someone became an organization member without going through our
 * accept flow, so they get the role they were invited to rather than a default.
 */
export async function invitationRoleForUser(
  tx: StoreTx,
  storeId: string,
  userId: string,
): Promise<{ roleId: string; invitationId: string } | null> {
  const users = await tx
    .select({ email: authSchema.user.email })
    .from(authSchema.user)
    .where(eq(authSchema.user.id, userId))
  const email = users[0]?.email
  if (!email) return null
  const rows = await tx
    .select({ roleId: storeInvitation.roleId, invitationId: storeInvitation.invitationId })
    .from(storeInvitation)
    .where(and(eq(storeInvitation.storeId, storeId), eq(storeInvitation.email, normalise(email))))
    .orderBy(desc(storeInvitation.createdAt))
    .limit(1)
  return rows[0] ?? null
}

/** Drops the record once the invitation has been turned into a membership. */
export async function forgetInvitation(tx: StoreTx, invitationId: string): Promise<void> {
  await tx.delete(storeInvitation).where(eq(storeInvitation.invitationId, invitationId))
}

/** Whether any pending invitation would grant this role, so it cannot be deleted yet. */
export async function roleHasPendingInvitations(tx: StoreTx, roleId: string): Promise<boolean> {
  const rows = await tx
    .select({ id: storeInvitation.id })
    .from(storeInvitation)
    .where(eq(storeInvitation.roleId, roleId))
    .limit(1)
  return rows.length > 0
}
