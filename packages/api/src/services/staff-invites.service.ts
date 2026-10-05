import { listRoles } from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { authSchema, store, storeInvitation } from '@commerce/db'
import { and, eq, inArray } from 'drizzle-orm'

/** An invitation as Better Auth's `listInvitations` returns it. */
export type AuthInvitation = {
  id: string
  email: string
  status: string
  organizationId: string
  inviterId: string
  expiresAt: Date | string
  createdAt?: Date | string | undefined
}

/** One open invitation on the Staff page. */
export type PendingInvite = {
  id: string
  email: string
  roleId: string | null
  roleName: string | null
  /** The inviter's email, or null when they are no longer in the store. */
  invitedBy: string | null
  sentAt: Date
  expiresAt: Date
  /** Past its expiry: it can no longer be accepted, only sent again. */
  expired: boolean
}

type DirectoryEntry = { id: string; email: string | null }

/**
 * The store's open invitations, newest first, with the role each grants and who sent it.
 * Accepted, declined and cancelled ones are left out; expired ones stay (flagged) so the
 * merchant can send them again. The inviter emails come from the organization directory the
 * caller already loaded, like `mergeDirectory`, so this never reads the user table itself.
 */
export async function describePendingInvites(
  tx: StoreTx,
  input: {
    storeId: string
    organizationId: string
    invitations: readonly AuthInvitation[]
    directory: readonly DirectoryEntry[]
  },
  now = new Date(),
): Promise<PendingInvite[]> {
  const open = input.invitations.filter(
    (i) => i.status === 'pending' && i.organizationId === input.organizationId,
  )
  if (open.length === 0) return []
  const recorded = await tx
    .select({ invitationId: storeInvitation.invitationId, roleId: storeInvitation.roleId })
    .from(storeInvitation)
    .where(
      and(
        eq(storeInvitation.storeId, input.storeId),
        inArray(
          storeInvitation.invitationId,
          open.map((i) => i.id),
        ),
      ),
    )
  const roleOf = new Map(recorded.map((r) => [r.invitationId, r.roleId]))
  const roleNames = new Map((await listRoles(tx, input.storeId)).map((r) => [r.id, r.name]))
  const emails = new Map(input.directory.map((d) => [d.id, d.email]))
  return open
    .map((i) => {
      const roleId = roleOf.get(i.id) ?? null
      const expiresAt = new Date(i.expiresAt)
      return {
        id: i.id,
        email: i.email,
        roleId,
        roleName: roleId ? (roleNames.get(roleId) ?? null) : null,
        invitedBy: emails.get(i.inviterId) ?? null,
        sentAt: new Date(i.createdAt ?? i.expiresAt),
        expiresAt,
        expired: expiresAt.getTime() <= now.getTime(),
      }
    })
    .sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime())
}

/**
 * One invitation, only when it belongs to this store's organization. Every invite action
 * checks this first: Better Auth itself would let someone who also runs another store act on
 * that store's invitations.
 */
export async function findOrganizationInvitation(
  tx: StoreTx,
  organizationId: string,
  invitationId: string,
) {
  const rows = await tx
    .select({
      id: authSchema.invitation.id,
      email: authSchema.invitation.email,
      status: authSchema.invitation.status,
      expiresAt: authSchema.invitation.expiresAt,
    })
    .from(authSchema.invitation)
    .where(
      and(
        eq(authSchema.invitation.id, invitationId),
        eq(authSchema.invitation.organizationId, organizationId),
      ),
    )
  return rows[0] ?? null
}

/** The store's own name, for the invitation email. */
export async function storeNameOf(tx: StoreTx, storeId: string): Promise<string | null> {
  const [s] = await tx.select({ name: store.name }).from(store).where(eq(store.id, storeId))
  return s?.name ?? null
}
