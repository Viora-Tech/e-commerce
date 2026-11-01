import { isFresh, stepUpAgeMs } from '@commerce/auth'
import {
  forgetInvitation,
  invitationRoleForUser,
  listRoles,
  lockMembershipHeal,
  type MemberAccess,
  memberAccess,
  type Permission,
  recordApiActivity,
  recordApiRead,
  seedSystemRoles,
  upsertMember,
} from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { organizationMembership, withStore } from '@commerce/db'
import { ORPCError } from '@orpc/server'
import { approvalKind, isReadPath, kindForInput } from '../mcp/action-catalogue'
import { setActorName } from '../services/actor.service'
import { ALREADY_REQUESTED, queueForApprover } from '../services/ai/assistant/service'
import { mustAsk } from './approval-rules'
import { memberProcedure, type SessionContext } from './base'
import { remember } from './request-memo'

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
  /** The role's "Needs approval" ticks (empty for the owner). */
  needsApproval: Permission[]
  /** Owners pass everything; everyone else must hold the grant. */
  can: (permission: Permission) => boolean
}

type Access = Pick<
  StoreScope,
  'roleId' | 'roleSlug' | 'roleName' | 'isOwner' | 'permissions' | 'needsApproval'
>

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
    needsApproval: found.needsApproval,
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
        needsApproval: invitedRole.needsApproval,
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
    needsApproval: target.needsApproval,
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

/**
 * The caller's store: requires an active organization the user belongs to and resolves it
 * to a store. Shared by `can` and `canDetached`. Once per request: a page's parallel store
 * calls share one lookup (`request-memo.ts`).
 */
async function findMembership(context: SessionContext) {
  const organizationId = context.session.activeOrganizationId
  if (!organizationId) throw noStore('PRECONDITION_FAILED', 'Pick a store first')
  const userId = context.session.user.id
  return remember(context.memo, `membership:${organizationId}:${userId}`, async () => {
    // The member row and the store id in one query, straight from the database on every
    // request (Better Auth's getFullOrganization read the session again, the organization, its
    // invitations, members and their users: seven round trips for the same answer).
    const found = await organizationMembership(context.db, organizationId, userId)
    if (!found) throw noStore('FORBIDDEN', 'Not a member of this store')
    if (!found.storeId) throw noStore('NOT_FOUND', 'No store for this organization')
    return { organizationId, storeId: found.storeId, role: found.role, userId }
  })
}

/**
 * Loads what the member may do and refuses when `required` is missing. An array means any
 * one of them is enough (the AI assistant: each of its tools checks its own permission).
 */
async function scopeFor(
  context: SessionContext,
  tx: StoreTx,
  member: Awaited<ReturnType<typeof findMembership>>,
  required: Permission | readonly Permission[] | undefined,
): Promise<StoreScope> {
  // Read from the database once per request (the first call's transaction; the page's other
  // calls wait on that read), never carried across requests: a revoked grant still applies
  // from the next request on.
  const access = await remember(context.memo, `access:${member.storeId}:${member.userId}`, () =>
    resolveAccess(tx, member.storeId, member.userId, member.role),
  )
  // An access token is its member capped to the token's areas, and never reaches a procedure
  // that names no permission (those check things only a person signed in should do).
  const token = context.apiPrincipal
  const holds = (permission: Permission) =>
    (access.isOwner || access.permissions.includes(permission)) &&
    (!token || token.permissions.includes(permission))
  const wanted = required === undefined ? [] : typeof required === 'string' ? [required] : required
  if (token && !wanted.length) {
    throw new ORPCError('FORBIDDEN', { message: 'Access tokens cannot use this' })
  }
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
 * the next request (a page's parallel calls share one read through `context.memo`).
 */
function storeProcedureWith(required?: Permission | readonly Permission[]) {
  return memberProcedure.use(async ({ context, next, path }, input) => {
    const member = await findMembership(context)
    context.log.set({ storeId: member.storeId })
    // Work that must wait until the transaction has committed (realtime publishes): a
    // listener must never hear about a row it cannot read yet, or one that rolled back.
    const committed: AfterCommit[] = []
    const afterCommit = (fn: AfterCommit) => {
      committed.push(fn)
    }
    const result = await withStore(context.db, member.storeId, async (tx: StoreTx) => {
      const scope = await scopeFor(context, tx, member, required)
      context.log.set({ role: scope.roleSlug })
      const waits = waitsForApproval(scope, path, required, input)
      if (waits) {
        // An approver running the change for someone: `approveAction` records who must approve.
        if (context.approvalReplay) throw approvalQueued(null, waits)
        return { [QUEUED]: await queue(context, tx, scope, path.join('.'), waits, input) }
      }
      // Runs now (the owner, or a role that does not need approval): a sensitive action also
      // needs a recent step-up when enforcement is on. Checked here, after approval, so a role
      // that would queue is never also asked to step up.
      await requireStepUp(context, path, input)
      const actor = context.session.user.name?.trim() || context.session.user.email
      await setActorName(tx, actor)
      try {
        const out = await next({ context: { scope, tx, afterCommit } })
        await logTokenCall(context, tx, member.storeId, path, required)
        return out
      } catch (error) {
        return report(context, member.storeId, error)
      }
    })
    for (const fn of committed) {
      try {
        await fn()
      } catch (error) {
        context.reportError?.(error, { storeId: member.storeId })
      }
    }
    // Queued for approval: the row is committed, and the caller hears it never ran.
    if (result && typeof result === 'object' && QUEUED in result) {
      const queued = (result as { [QUEUED]: Queued })[QUEUED]
      throw approvalQueued(queued.id, null, queued.alreadyRequested)
    }
    return result
  })
}

const QUEUED = Symbol('queued for approval')
type Queued = { id: string; alreadyRequested: boolean }

/**
 * Code a caller (admin pages, MCP, the API) reads as "sent for approval, nothing changed yet".
 * `data.alreadyRequested`: the same change was already waiting, so no new request was made.
 */
export const APPROVAL_QUEUED = 'APPROVAL_QUEUED'

function approvalQueued(id: string | null, permission: Permission | null, already = false) {
  return new ORPCError(APPROVAL_QUEUED, {
    status: 403,
    message: already
      ? `${ALREADY_REQUESTED} The same change is already waiting in Settings → Approvals, so nothing new was sent.`
      : 'Sent for approval: your role needs approval for this. It runs once a member who can approve it does so in Settings → Approvals.',
    data: { approvalId: id, permission, alreadyRequested: already },
  })
}

/** Code the admin reads as "re-verify first": it opens the step-up dialog and retries the call. */
export const STEP_UP_REQUIRED = 'STEP_UP_REQUIRED'

function stepUpRequired(path: string) {
  return new ORPCError(STEP_UP_REQUIRED, {
    status: 403,
    message: "Confirm it's you to continue — this action needs a recent sign-in check.",
    data: { path },
  })
}

/**
 * Step-up gate (A5), on calls that run now (never queued): when enforcement is on, a sensitive
 * action from a real browser session is refused unless that session re-verified within the
 * window. Access tokens and MCP carry no session to step up, so they are never gated here — the
 * MCP surface already holds sensitive actions for a person's approval. The freshness stamp is
 * read straight from the session row (`stepUpAgeMs`), not from the cookie-cached `getSession`.
 */
async function requireStepUp(
  context: SessionContext,
  path: readonly string[],
  input: unknown,
): Promise<void> {
  if (!context.stepUpEnforce || context.apiPrincipal) return
  const dotted = path.join('.')
  if (!dotted || kindForInput(dotted, input) !== 'sensitive') return
  const age = await stepUpAgeMs(context.db, context.session.sessionId)
  if (isFresh(age)) return
  throw stepUpRequired(dotted)
}

/**
 * The permission whose "Needs approval" tick holds this call back, or null when it runs now:
 * a change (the catalogue's write or sensitive, never a read) behind one `can(permission)` that
 * the member's role ticks. The owner never waits. A people-only path (a browser hand-off, a
 * token, deciding approvals) or a file upload cannot wait, so it is refused.
 *
 * Gaps, by design: `canAny` and `canDetached` procedures are not held back (no single
 * permission to tick), nor a server-side `call()` without a path.
 */
function waitsForApproval(
  scope: StoreScope,
  path: readonly string[],
  required: Permission | readonly Permission[] | undefined,
  input: unknown,
): Permission | null {
  if (typeof required !== 'string' || !mustAsk(scope, required)) return null
  const dotted = path.join('.')
  // A server-side `call()` without a path (admin pages reading data) cannot be classified or
  // queued; every request from the browser, MCP or the API carries its path.
  if (!dotted || isReadPath(dotted)) return null
  if (!approvalKind(dotted) || hasFile(input)) {
    throw new ORPCError('FORBIDDEN', {
      message: `Your role needs approval for ${describe(required)}, and this cannot wait for it. Ask a member who can approve it to do it.`,
    })
  }
  return required
}

const hasFile = (value: unknown): boolean =>
  value instanceof Blob ||
  (value !== null &&
    typeof value === 'object' &&
    Object.values(value as Record<string, unknown>).some(hasFile))

/** Stores the call in Approvals for a different member to approve (or finds it already there). */
async function queue(
  context: SessionContext,
  tx: StoreTx,
  scope: StoreScope,
  path: string,
  permission: Permission,
  input: unknown,
): Promise<Queued> {
  const token = context.apiPrincipal
  const view = await queueForApprover(tx, {
    storeId: scope.storeId,
    userId: scope.userId,
    source: token ? (token.kind === 'oauth' ? 'mcp' : 'api') : 'admin',
    path,
    input,
    permission,
    now: new Date(),
  })
  const alreadyRequested = view.alreadyRequested === true
  if (token) {
    await recordApiActivity(tx, scope.storeId, {
      grantId: token.grantId,
      kind: 'approval',
      tool: path,
      summary: `${token.name} asked to run ${path} → ${alreadyRequested ? 'already requested, ' : ''}waiting approval`,
      detail: `${token.userName} · their role needs approval for ${describe(permission)}`,
      aiActionId: view.id,
      at: new Date(),
    })
  }
  return { id: view.id, alreadyRequested }
}

/** Runs after the store transaction commits; failures are reported, never thrown. */
export type AfterCommit = () => void | Promise<void>

/**
 * Settings → MCP & API → Activity: a call made with an access token. Changes are logged one by
 * one; repeated reads of the same procedure fold into one row per ten minutes.
 */
async function logTokenCall(
  context: SessionContext,
  tx: StoreTx,
  storeId: string,
  path: readonly string[],
  required: Permission | readonly Permission[] | undefined,
) {
  const token = context.apiPrincipal
  if (!token) return
  const wanted = required === undefined ? [] : typeof required === 'string' ? [required] : required
  const procedure = path.join('.')
  const reads = wanted.every((perm) => perm.endsWith('.read'))
  const entry = { grantId: token.grantId, tool: procedure, detail: `API · ${procedure}` }
  if (reads)
    await recordApiRead(tx, storeId, { ...entry, summary: `${token.name} read ${path[0]}` })
  else
    await recordApiActivity(tx, storeId, {
      ...entry,
      kind: 'change',
      summary: `${token.name} changed ${path[0]}`,
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
  return detachedWith(permission)
}

/**
 * `storeProcedure` (any member, no permission) for a handler that waits on an outside
 * service, like `canDetached`: no transaction stays open; the handler opens its own
 * `withStore` for reads and writes. "Report a bug" files GitHub issues through it.
 */
export const storeProcedureDetached = detachedWith(undefined)

function detachedWith(permission: Permission | readonly Permission[] | undefined) {
  return memberProcedure.use(async ({ context, next, path }) => {
    const member = await findMembership(context)
    context.log.set({ storeId: member.storeId })
    const scope = await withStore(context.db, member.storeId, (tx: StoreTx) =>
      scopeFor(context, tx, member, permission),
    )
    context.log.set({ role: scope.roleSlug })
    try {
      const result = await next({ context: { scope } })
      if (context.apiPrincipal)
        await withStore(context.db, member.storeId, (tx: StoreTx) =>
          logTokenCall(context, tx, member.storeId, path, permission),
        )
      return result
    } catch (error) {
      return report(context, member.storeId, error)
    }
  })
}
