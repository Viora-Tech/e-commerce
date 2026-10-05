import {
  forgetInvitation,
  invitationRoleForUser,
  listRoles,
  lockMembershipHeal,
  type MemberAccess,
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

function accessOf(found: MemberAccess): Access {
  return {
    roleId: found.roleId,
    roleSlug: found.roleSlug,
    roleName: found.roleName,
    isOwner: found.isOwner,
    permissions: found.permissions,
  }
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
  const known = await memberAccess(tx, storeId, userId)
  if (known) return accessOf(known)

  // One admin page load makes several store calls at once (layout and page), and each would
  // heal here: concurrent `seedSystemRoles` rewrites collide on role_permission's unique key
  // and all but one call fail. Heal one at a time per store, then re-read: the call that
  // waited usually finds the membership the first one just wrote.
  await lockMembershipHeal(tx, storeId)
  const healed = await memberAccess(tx, storeId, userId)
  if (healed) return accessOf(healed)

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

/** Marks the errors that mean "there is no store to work in", the only ones the admin answers
 *  with the store picker. A missing permission or a failed query is not one of them. */
const NO_STORE = { reason: 'no_store' } as const

function noStore(code: 'PRECONDITION_FAILED' | 'FORBIDDEN' | 'NOT_FOUND', message: string) {
  return new ORPCError(code, { message, data: NO_STORE })
}

/**
 * True when a store call failed only because the caller has no store to work in: none picked,
 * no longer a member, or the store is gone. Admin pages send these to the store picker and let
 * every other error reach the error page (a redirect there would loop, and hide the error).
 */
export function isNoStoreError(error: unknown): boolean {
  return error instanceof ORPCError && error.data?.reason === NO_STORE.reason
}

/** Better Auth refuses `getFullOrganization` (403 not a member, 400 no such organization). */
function isOrganizationRefusal(error: unknown): boolean {
  const status = (error as { statusCode?: unknown } | null)?.statusCode
  return status === 400 || status === 403
}

/**
 * The caller's store: requires an active organization the user belongs to and resolves it
 * to a store. Shared by `can` and `canDetached`.
 */
async function findMembership(context: SessionContext) {
  const organizationId = context.session.activeOrganizationId
  if (!organizationId) throw noStore('PRECONDITION_FAILED', 'Pick a store first')

  const org = await context.auth.api
    .getFullOrganization({ headers: context.headers, query: { organizationId } })
    .catch((error: unknown) => {
      if (isOrganizationRefusal(error)) throw noStore('FORBIDDEN', 'Not a member of this store')
      throw error
    })
  const membership = org?.members.find((m) => m.userId === context.session.user.id)
  if (!membership) throw noStore('FORBIDDEN', 'Not a member of this store')

  const storeId = await resolveStoreForOrganization(context.db, organizationId)
  if (!storeId) throw noStore('NOT_FOUND', 'No store for this organization')
  return { organizationId, storeId, role: membership.role, userId: context.session.user.id }
}

/**
 * Loads what the member may do and refuses when `required` is missing. An array means any
 * one of them is enough (the AI assistant: each of its tools checks its own permission).
 */
async function scopeFor(
  tx: StoreTx,
  member: Awaited<ReturnType<typeof findMembership>>,
  required: Permission | readonly Permission[] | undefined,
): Promise<StoreScope> {
  const access = await resolveAccess(tx, member.storeId, member.userId, member.role)
  const holds = (permission: Permission) =>
    access.isOwner || access.permissions.includes(permission)
  const wanted = required === undefined ? [] : typeof required === 'string' ? [required] : required
  if (wanted.length && !wanted.some(holds)) {
    const first = wanted[0] as Permission
    throw new ORPCError('FORBIDDEN', {
      message: `Your role does not allow ${describe(first)}`,
      data: { required: first, role: access.roleSlug },
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
function storeProcedureWith(required?: Permission | readonly Permission[]) {
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
 * `can` for a handler that serves several permission grains at once and checks the exact one
 * itself (`context.scope.can(...)`): the caller must hold at least one of `permissions`. The
 * AI assistant's approve and undo use it; each action re-checks its own permission.
 */
export function canAny(permissions: readonly Permission[]) {
  return storeProcedureWith(permissions)
}

/**
 * `can(permission)` for handlers that wait on a slow outside service (an AI model) or stream
 * their answer. Membership and permission are checked in a short `withStore` transaction
 * exactly as `can` does, then the handler runs with `scope` but no `tx`: it opens its own
 * `withStore(context.db, scope.storeId, ...)` for each read or write. So no Postgres
 * connection sits idle in a transaction while a model thinks, and a streamed answer (whose
 * generator runs after the middleware returns) never touches a committed transaction.
 */
export function canDetached(permission: Permission | readonly Permission[]) {
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
