import {
  forgetInvitation,
  invitationRole,
  listRoles,
  seedSystemRoles,
  upsertMember,
} from '@commerce/core'
import type { Db } from '@commerce/db'
import {
  authSchema,
  resolveStoreForOrganization,
  store,
  storeMember,
  withStore,
} from '@commerce/db'
import { and, eq } from 'drizzle-orm'

export type InvitationState = 'pending' | 'accepted' | 'cancelled' | 'expired'

export type InvitationPreview =
  | { state: 'missing' }
  | {
      state: InvitationState
      email: string
      storeName: string
      inviterName: string | null
      roleName: string | null
    }

type InvitationRow = typeof authSchema.invitation.$inferSelect

async function findInvitation(db: Db, id: string): Promise<InvitationRow | null> {
  const rows = await db.select().from(authSchema.invitation).where(eq(authSchema.invitation.id, id))
  return rows[0] ?? null
}

/** Better Auth's statuses plus expiry, which it does not store. */
function stateOf(row: InvitationRow, now: Date): InvitationState {
  if (row.status === 'accepted') return 'accepted'
  if (row.status === 'canceled' || row.status === 'rejected') return 'cancelled'
  if (row.expiresAt.getTime() <= now.getTime()) return 'expired'
  return 'pending'
}

/**
 * What the accept page shows before anyone signs in. Invitation ids are random
 * and unguessable, and this returns only what the invitation email already said.
 */
export async function previewInvitation(db: Db, id: string): Promise<InvitationPreview> {
  const row = await findInvitation(db, id)
  if (!row) return { state: 'missing' }
  const storeId = await resolveStoreForOrganization(db, row.organizationId)
  if (!storeId) return { state: 'missing' }

  const inviters = await db
    .select({ name: authSchema.user.name })
    .from(authSchema.user)
    .where(eq(authSchema.user.id, row.inviterId))

  const details = await withStore(db, storeId, async (tx) => {
    const stores = await tx.select({ name: store.name }).from(store).where(eq(store.id, storeId))
    const roleId = await invitationRole(tx, storeId, id)
    const roles = roleId ? await listRoles(tx, storeId) : []
    return {
      storeName: stores[0]?.name ?? '',
      roleName: roles.find((r) => r.id === roleId)?.name ?? null,
    }
  })

  return {
    state: stateOf(row, new Date()),
    email: row.email,
    storeName: details.storeName,
    inviterName: inviters[0]?.name ?? null,
    roleName: details.roleName,
  }
}

export class InvitationError extends Error {
  constructor(
    readonly reason: 'missing' | 'not_pending' | 'expired' | 'wrong_email',
    message: string,
  ) {
    super(message)
  }
}

/**
 * Turns an invitation into a store membership with the role chosen on the Staff
 * page, then joins the organization through Better Auth.
 *
 * Ordering matters: the store role is written first, so there is never a moment
 * where the person is an organization member without it (the store guard would
 * otherwise fall back to a default role). If Better Auth refuses, the pending
 * invitation record is still there and nothing was granted that the guard reads.
 */
export async function acceptInvitation(input: {
  db: Db
  invitationId: string
  user: { id: string; email: string }
  joinOrganization: () => Promise<void>
}): Promise<{ storeId: string; organizationId: string }> {
  const row = await findInvitation(input.db, input.invitationId)
  if (!row) throw new InvitationError('missing', 'This invitation does not exist')
  const state = stateOf(row, new Date())
  if (state === 'expired') throw new InvitationError('expired', 'This invitation has expired')
  if (state !== 'pending') {
    throw new InvitationError('not_pending', 'This invitation is no longer open')
  }
  if (row.email.trim().toLowerCase() !== input.user.email.trim().toLowerCase()) {
    throw new InvitationError('wrong_email', `This invitation is for ${row.email}`)
  }
  const storeId = await resolveStoreForOrganization(input.db, row.organizationId)
  if (!storeId) throw new InvitationError('missing', 'This store no longer exists')

  const createdMember = await withStore(input.db, storeId, async (tx) => {
    const recorded = await invitationRole(tx, storeId, input.invitationId)
    let roleId = recorded
    if (!roleId) {
      // Invitations created before roles were recorded get the least access.
      await seedSystemRoles(tx, storeId)
      const roles = await listRoles(tx, storeId)
      roleId = roles.find((r) => r.slug === 'staff')?.id ?? null
    }
    if (!roleId) throw new Error('No role to grant')
    const before = await tx
      .select({ id: storeMember.id })
      .from(storeMember)
      .where(and(eq(storeMember.storeId, storeId), eq(storeMember.userId, input.user.id)))
    await upsertMember(tx, {
      storeId,
      userId: input.user.id,
      roleId,
      status: 'active',
      invitedBy: row.inviterId,
    })
    return before.length === 0
  })

  try {
    await input.joinOrganization()
  } catch (err) {
    // Leave no member row behind for someone who never joined.
    if (createdMember) {
      await withStore(input.db, storeId, async (tx) => {
        await tx
          .delete(storeMember)
          .where(and(eq(storeMember.storeId, storeId), eq(storeMember.userId, input.user.id)))
      })
    }
    throw err
  }

  await withStore(input.db, storeId, async (tx) => {
    await forgetInvitation(tx, input.invitationId)
  })
  return { storeId, organizationId: row.organizationId }
}
