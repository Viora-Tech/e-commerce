import type { StoreTx } from '@commerce/db'
import { role, rolePermission, storeMember } from '@commerce/db'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { roleHasPendingInvitations } from './invitations'
import { isSystemRoleSlug, roleSlug, SYSTEM_ROLES } from './roles'
import { type Permission, sanitisePermissions } from './statement'

export type StoreRole = {
  id: string
  name: string
  slug: string
  description: string | null
  isSystem: boolean
  permissions: Permission[]
  memberCount: number
}

export type StoreMemberRecord = {
  id: string
  userId: string
  roleId: string
  roleName: string
  roleSlug: string
  status: string
  invitedBy: string | null
  createdAt: Date
}

/** What the guard needs to answer "may this member do X?". */
export type MemberAccess = {
  memberId: string
  roleId: string
  roleSlug: string
  roleName: string
  isOwner: boolean
  permissions: Permission[]
}

/**
 * Creates the owner, administrator and staff rows for a store. Idempotent, so
 * it is safe to call on every store creation and from a repair script.
 */
export async function seedSystemRoles(tx: StoreTx, storeId: string): Promise<void> {
  for (const spec of SYSTEM_ROLES) {
    const existing = await tx
      .select({ id: role.id })
      .from(role)
      .where(and(eq(role.storeId, storeId), eq(role.slug, spec.slug)))
    const roleId =
      existing[0]?.id ??
      (
        await tx
          .insert(role)
          .values({
            storeId,
            name: spec.name,
            slug: spec.slug,
            description: spec.description,
            isSystem: true,
          })
          .returning({ id: role.id })
      )[0]?.id
    if (!roleId) continue
    await writePermissions(tx, storeId, roleId, spec.permissions)
  }
}

/** Replaces a role's grants with exactly `next`, ignoring anything off-statement. */
export async function writePermissions(
  tx: StoreTx,
  storeId: string,
  roleId: string,
  next: readonly string[],
): Promise<Permission[]> {
  const clean = sanitisePermissions(next)
  await tx.delete(rolePermission).where(eq(rolePermission.roleId, roleId))
  if (clean.length > 0) {
    await tx
      .insert(rolePermission)
      .values(clean.map((permission) => ({ storeId, roleId, permission })))
  }
  return clean
}

/** Roles for the store, each with its grants and how many people hold it. */
export async function listRoles(tx: StoreTx, storeId: string): Promise<StoreRole[]> {
  const rows = await tx
    .select({
      id: role.id,
      name: role.name,
      slug: role.slug,
      description: role.description,
      isSystem: role.isSystem,
    })
    .from(role)
    .where(eq(role.storeId, storeId))
    .orderBy(role.isSystem, role.name)
  if (rows.length === 0) return []

  const ids = rows.map((r) => r.id)
  const grants = await tx
    .select({ roleId: rolePermission.roleId, permission: rolePermission.permission })
    .from(rolePermission)
    .where(inArray(rolePermission.roleId, ids))
  const counts = await tx
    .select({ roleId: storeMember.roleId, count: sql<number>`count(*)::int` })
    .from(storeMember)
    .where(inArray(storeMember.roleId, ids))
    .groupBy(storeMember.roleId)

  const byRole = new Map<string, string[]>()
  for (const g of grants) {
    const list = byRole.get(g.roleId) ?? []
    list.push(g.permission)
    byRole.set(g.roleId, list)
  }
  const countByRole = new Map(counts.map((c) => [c.roleId, c.count]))

  return rows.map((r) => ({
    ...r,
    permissions: sanitisePermissions(byRole.get(r.id) ?? []),
    memberCount: countByRole.get(r.id) ?? 0,
  }))
}

/** Resolves what one user may do in one store. Null when they are not a member. */
export async function memberAccess(
  tx: StoreTx,
  storeId: string,
  userId: string,
): Promise<MemberAccess | null> {
  const rows = await tx
    .select({
      memberId: storeMember.id,
      roleId: role.id,
      roleSlug: role.slug,
      roleName: role.name,
    })
    .from(storeMember)
    .innerJoin(role, eq(role.id, storeMember.roleId))
    .where(and(eq(storeMember.storeId, storeId), eq(storeMember.userId, userId)))
  const row = rows[0]
  if (!row) return null

  const grants = await tx
    .select({ permission: rolePermission.permission })
    .from(rolePermission)
    .where(eq(rolePermission.roleId, row.roleId))

  return {
    memberId: row.memberId,
    roleId: row.roleId,
    roleSlug: row.roleSlug,
    roleName: row.roleName,
    isOwner: row.roleSlug === 'owner',
    permissions: sanitisePermissions(grants.map((g) => g.permission)),
  }
}

/** Members of the store with their role, newest last. */
export async function listMembers(tx: StoreTx, storeId: string): Promise<StoreMemberRecord[]> {
  return await tx
    .select({
      id: storeMember.id,
      userId: storeMember.userId,
      roleId: storeMember.roleId,
      roleName: role.name,
      roleSlug: role.slug,
      status: storeMember.status,
      invitedBy: storeMember.invitedBy,
      createdAt: storeMember.createdAt,
    })
    .from(storeMember)
    .innerJoin(role, eq(role.id, storeMember.roleId))
    .where(eq(storeMember.storeId, storeId))
    .orderBy(storeMember.createdAt)
}

/** Adds a member, or moves an existing one onto `roleId`. */
export async function upsertMember(
  tx: StoreTx,
  input: {
    storeId: string
    userId: string
    roleId: string
    status?: 'active' | 'invited'
    invitedBy?: string | null
  },
): Promise<void> {
  const existing = await tx
    .select({ id: storeMember.id })
    .from(storeMember)
    .where(and(eq(storeMember.storeId, input.storeId), eq(storeMember.userId, input.userId)))
  if (existing[0]) {
    await tx
      .update(storeMember)
      .set({ roleId: input.roleId, status: input.status ?? 'active', updatedAt: new Date() })
      .where(eq(storeMember.id, existing[0].id))
    return
  }
  await tx.insert(storeMember).values({
    storeId: input.storeId,
    userId: input.userId,
    roleId: input.roleId,
    status: input.status ?? 'active',
    invitedBy: input.invitedBy ?? null,
  })
}

export type SaveRoleInput = {
  storeId: string
  id?: string | undefined
  name: string
  description?: string | null
  permissions: readonly string[]
}

/** Creates or renames a custom role and rewrites its grants. System rows are refused. */
export async function saveRole(tx: StoreTx, input: SaveRoleInput): Promise<string> {
  const name = input.name.trim()
  if (!name) throw new Error('Give the role a name')
  const slug = roleSlug(name)
  if (!slug) throw new Error('Give the role a name using letters or numbers')

  if (input.id) {
    const current = await tx.select().from(role).where(eq(role.id, input.id))
    const row = current[0]
    if (!row || row.storeId !== input.storeId) throw new Error('Role not found')
    if (row.isSystem) throw new Error('Built in roles cannot be changed')
    await tx
      .update(role)
      .set({ name, slug, description: input.description ?? null, updatedAt: new Date() })
      .where(eq(role.id, input.id))
    await writePermissions(tx, input.storeId, input.id, input.permissions)
    return input.id
  }

  if (isSystemRoleSlug(slug)) throw new Error('That name is reserved')
  const clash = await tx
    .select({ id: role.id })
    .from(role)
    .where(and(eq(role.storeId, input.storeId), eq(role.slug, slug)))
  if (clash[0]) throw new Error('A role with that name already exists')

  const created = await tx
    .insert(role)
    .values({
      storeId: input.storeId,
      name,
      slug,
      description: input.description ?? null,
      isSystem: false,
    })
    .returning({ id: role.id })
  const id = created[0]?.id
  if (!id) throw new Error('Could not create the role')
  await writePermissions(tx, input.storeId, id, input.permissions)
  return id
}

/** Deletes a custom role once nobody holds it. */
export async function deleteRole(tx: StoreTx, storeId: string, id: string): Promise<void> {
  const rows = await tx.select().from(role).where(eq(role.id, id))
  const row = rows[0]
  if (!row || row.storeId !== storeId) throw new Error('Role not found')
  if (row.isSystem) throw new Error('Built in roles cannot be deleted')
  const held = await tx
    .select({ id: storeMember.id })
    .from(storeMember)
    .where(eq(storeMember.roleId, id))
  if (held.length > 0) throw new Error('Move the members on this role first')
  if (await roleHasPendingInvitations(tx, id)) {
    throw new Error('Cancel the pending invitations to this role first')
  }
  await tx.delete(role).where(eq(role.id, id))
}
