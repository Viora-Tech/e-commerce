import {
  deleteRole,
  type listMembers,
  listRoles,
  type Permission,
  type StoreRole,
  sanitisePermissions,
  saveRole,
  upsertMember,
} from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { storeMember } from '@commerce/db'
import { and, eq } from 'drizzle-orm'

export type StaffMember = {
  id: string
  userId: string
  name: string | null
  email: string | null
  roleId: string
  roleName: string
  roleSlug: string
  status: string
  isOwner: boolean
  createdAt: Date
}

type DirectoryEntry = { id: string; name: string | null; email: string | null }

/**
 * Joins the authorisation rows with the Better Auth directory. The user table
 * sits outside RLS, so the caller passes the rows it already loaded from the
 * organization rather than this service reaching across the boundary.
 */
export function mergeDirectory(
  members: Awaited<ReturnType<typeof listMembers>>,
  directory: readonly DirectoryEntry[],
): StaffMember[] {
  const byId = new Map(directory.map((d) => [d.id, d]))
  return members.map((m) => ({
    id: m.id,
    userId: m.userId,
    name: byId.get(m.userId)?.name ?? null,
    email: byId.get(m.userId)?.email ?? null,
    roleId: m.roleId,
    roleName: m.roleName,
    roleSlug: m.roleSlug,
    status: m.status,
    isOwner: m.roleSlug === 'owner',
    createdAt: m.createdAt,
  }))
}

export async function storeRoles(tx: StoreTx, storeId: string): Promise<StoreRole[]> {
  return await listRoles(tx, storeId)
}

export type ActorContext = {
  storeId: string
  userId: string
  isOwner: boolean
  permissions: Permission[]
}

/** Refuses grants the actor does not hold, so nobody can promote themselves. */
export function assertGrantable(actor: ActorContext, next: readonly string[]): Permission[] {
  const clean = sanitisePermissions(next)
  if (actor.isOwner) return clean
  const beyond = clean.filter((p) => !actor.permissions.includes(p))
  if (beyond.length > 0) {
    throw new Error(`You cannot grant ${beyond.join(', ')} because your role does not include it`)
  }
  return clean
}

export async function saveStoreRole(
  tx: StoreTx,
  actor: ActorContext,
  input: {
    id?: string | undefined
    name: string
    description?: string | null | undefined
    permissions: string[]
  },
): Promise<string> {
  const permissions = assertGrantable(actor, input.permissions)
  return await saveRole(tx, {
    storeId: actor.storeId,
    id: input.id,
    name: input.name,
    description: input.description ?? null,
    permissions,
  })
}

export async function deleteStoreRole(
  tx: StoreTx,
  storeId: string,
  id: string,
): Promise<{ ok: true }> {
  await deleteRole(tx, storeId, id)
  return { ok: true }
}

/** Moves a member onto another role, with the guards a team page needs. */
export async function changeMemberRole(
  tx: StoreTx,
  actor: ActorContext,
  input: { memberId: string; roleId: string },
): Promise<void> {
  const rows = await tx
    .select()
    .from(storeMember)
    .where(and(eq(storeMember.id, input.memberId), eq(storeMember.storeId, actor.storeId)))
  const member = rows[0]
  if (!member) throw new Error('Member not found')
  if (member.userId === actor.userId) throw new Error('You cannot change your own role')

  const roles = await listRoles(tx, actor.storeId)
  const current = roles.find((r) => r.id === member.roleId)
  const target = roles.find((r) => r.id === input.roleId)
  if (!target) throw new Error('Role not found')
  if (current?.slug === 'owner') throw new Error('The owner role cannot be changed here')
  if (target.slug === 'owner' && !actor.isOwner)
    throw new Error('Only the owner can hand over ownership')
  assertGrantable(actor, target.permissions)

  await upsertMember(tx, {
    storeId: actor.storeId,
    userId: member.userId,
    roleId: target.id,
    status: member.status === 'invited' ? 'invited' : 'active',
  })
}

/** Removes a member's access to this store. Better Auth membership is cleared by the caller. */
export async function removeMember(
  tx: StoreTx,
  actor: ActorContext,
  memberId: string,
): Promise<{ userId: string }> {
  const rows = await tx
    .select()
    .from(storeMember)
    .where(and(eq(storeMember.id, memberId), eq(storeMember.storeId, actor.storeId)))
  const member = rows[0]
  if (!member) throw new Error('Member not found')
  if (member.userId === actor.userId) throw new Error('You cannot remove yourself')

  const roles = await listRoles(tx, actor.storeId)
  if (roles.find((r) => r.id === member.roleId)?.slug === 'owner') {
    throw new Error('The owner cannot be removed')
  }
  await tx.delete(storeMember).where(eq(storeMember.id, memberId))
  return { userId: member.userId }
}
