import {
  forgetInvitation,
  invitationRoleForUser,
  listRoles,
  memberAccess,
  type Permission,
  seedSystemRoles,
  upsertMember,
} from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { resolveStoreForOrganization, withStore } from '@commerce/db'
import { ORPCError } from '@orpc/server'
import { protectedProcedure, type SessionContext } from './base'

export type StoreScope = {
  storeId: string
  organizationId: string
  /** Better Auth organization role. Authorisation reads `permissions`, not this. */
  role: string
  userId: string
  roleId: string
  roleSlug: string
  roleName: string
  isOwner: boolean
  permissions: Permission[]
  /** Owners pass everything; everyone else must hold the grant. */
  can: (permission: Permission) => boolean
}

type Access = Pick<StoreScope, 'roleId' | 'roleSlug' | 'roleName' | 'isOwner' | 'permissions'>

/** "orders.refund" reads as "refund orders" in the message a merchant sees. */
function describe(permission: Permission): string {
  const [resource, action] = permission.split('.')
  return `${action} ${String(resource).replace(/_/g, ' ')}`
}

/**
 * Reads the member's role. Stores created before roles existed, and members
 * added straight through Better Auth, are healed here: the system roles are
 * seeded and the organization owner is mapped onto the owner role.
 */
async function resolveAccess(
  tx: StoreTx,
  storeId: string,
  userId: string,
  organizationRole: string,
): Promise<Access> {
  const found = await memberAccess(tx, storeId, userId)
  if (found) {
    return {
      roleId: found.roleId,
      roleSlug: found.roleSlug,
      roleName: found.roleName,
      isOwner: found.isOwner,
      permissions: found.permissions,
    }
  }

  await seedSystemRoles(tx, storeId)
  const roles = await listRoles(tx, storeId)

  // Someone who joined through an invitation gets the role they were invited to,
  // even if they accepted through Better Auth directly rather than our page. The
  // admin fallback below is only for members who predate roles.
  if (organizationRole !== 'owner') {
    const invited = await invitationRoleForUser(tx, storeId, userId)
    const invitedRole = invited ? roles.find((r) => r.id === invited.roleId) : undefined
    if (invited && invitedRole) {
      await upsertMember(tx, { storeId, userId, roleId: invitedRole.id })
      await forgetInvitation(tx, invited.invitationId)
      return {
        roleId: invitedRole.id,
        roleSlug: invitedRole.slug,
        roleName: invitedRole.name,
        isOwner: invitedRole.slug === 'owner',
        permissions: invitedRole.permissions,
      }
    }
  }

  const slug = organizationRole === 'owner' ? 'owner' : 'admin'
  const target = roles.find((r) => r.slug === slug) ?? roles.find((r) => r.slug === 'owner')
  if (!target) throw new ORPCError('INTERNAL_SERVER_ERROR', { message: 'No roles for this store' })
  await upsertMember(tx, { storeId, userId, roleId: target.id })
  return {
    roleId: target.id,
    roleSlug: target.slug,
    roleName: target.name,
    isOwner: target.slug === 'owner',
    permissions: target.permissions,
  }
}

/**
 * The caller's store: requires an active organization the user belongs to and resolves it
 * to a store. Shared by `can` and `canDetached`.
 */
async function findMembership(context: SessionContext) {
  const organizationId = context.session.activeOrganizationId
  if (!organizationId) throw new ORPCError('PRECONDITION_FAILED', { message: 'Pick a store first' })

  const org = await context.auth.api.getFullOrganization({
    headers: context.headers,
    query: { organizationId },
  })
  const membership = org?.members.find((m) => m.userId === context.session.user.id)
  if (!membership) throw new ORPCError('FORBIDDEN', { message: 'Not a member of this store' })

  const storeId = await resolveStoreForOrganization(context.db, organizationId)
  if (!storeId) throw new ORPCError('NOT_FOUND', { message: 'No store for this organization' })
  return { organizationId, storeId, role: membership.role, userId: context.session.user.id }
}

/** Loads what the member may do and refuses when `required` is missing. */
async function scopeFor(
  tx: StoreTx,
  member: Awaited<ReturnType<typeof findMembership>>,
  required: Permission | undefined,
): Promise<StoreScope> {
  const access = await resolveAccess(tx, member.storeId, member.userId, member.role)
  const holds = (permission: Permission) =>
    access.isOwner || access.permissions.includes(permission)
  if (required && !holds(required)) {
    throw new ORPCError('FORBIDDEN', {
      message: `Your role does not allow ${describe(required)}`,
      data: { required, role: access.roleSlug },
    })
  }
  return { ...member, ...access, can: holds }
}

/** ORPCError is a deliberate, client-facing response (unauthorized, validation, not found); only unexpected exceptions are worth an error-tracking event. */
function report(context: SessionContext, storeId: string, error: unknown): never {
  if (!(error instanceof ORPCError)) context.reportError?.(error, { storeId })
  throw error
}

/**
 * Requires an active organization the user belongs to, resolves it to a store,
 * loads what that member may do, and runs the handler inside `withStore` so
 * every query is tenant-scoped. Permissions are read from the database on each
 * request rather than carried in the session, so revoking one takes effect on
 * the next call.
 */
function storeProcedureWith(required?: Permission) {
  return protectedProcedure.use(async ({ context, next }) => {
    const member = await findMembership(context)
    return withStore(context.db, member.storeId, async (tx: StoreTx) => {
      const scope = await scopeFor(tx, member, required)
      try {
        return await next({ context: { scope, tx } })
      } catch (error) {
        return report(context, member.storeId, error)
      }
    })
  })
}

/** Store-scoped procedure with no permission of its own. */
export const storeProcedure = storeProcedureWith()

/** Store-scoped procedure that refuses callers without `permission`. */
export function can(permission: Permission) {
  return storeProcedureWith(permission)
}

/**
 * `can(permission)` for handlers that wait on a slow outside service (an AI model) or stream
 * their answer. Membership and permission are checked in a short `withStore` transaction
 * exactly as `can` does, then the handler runs with `scope` but no `tx`: it opens its own
 * `withStore(context.db, scope.storeId, ...)` for each read or write. So no Postgres
 * connection sits idle in a transaction while a model thinks, and a streamed answer (whose
 * generator runs after the middleware returns) never touches a committed transaction.
 */
export function canDetached(permission: Permission) {
  return protectedProcedure.use(async ({ context, next }) => {
    const member = await findMembership(context)
    const scope = await withStore(context.db, member.storeId, (tx: StoreTx) =>
      scopeFor(tx, member, permission),
    )
    try {
      return await next({ context: { scope } })
    } catch (error) {
      return report(context, member.storeId, error)
    }
  })
}
