import { ORPCError, os } from '@orpc/server'
import type { ApiContext } from '../context'
import { type LogContext, procedureLog } from './logging'
import { remember } from './request-memo'

/** Public procedure. No session required. Every call logs one wide event (`procedureLog`). */
export const base = os.$context<ApiContext>().use(procedureLog)

type SessionUser = { id: string; email: string; name: string }
type Session = {
  user: SessionUser
  activeOrganizationId: string | null
  /** Better Auth's id for this browser's session (Account → Sessions marks it "This device"). */
  sessionId: string
}

/** What a handler behind `protectedProcedure` sees. */
export type SessionContext = ApiContext & { session: Session }

/** The cookie session of the merchant making this request, or UNAUTHORIZED. */
async function cookieSession(context: ApiContext & LogContext): Promise<Session> {
  const s = await remember(context.memo, 'session', () =>
    context.auth.api.getSession({ headers: context.headers }),
  )
  if (!s) throw new ORPCError('UNAUTHORIZED', { message: 'Sign in required' })
  context.log.set({ userId: s.user.id })
  return {
    user: { id: s.user.id, email: s.user.email, name: s.user.name },
    activeOrganizationId:
      (s.session as { activeOrganizationId?: string | null }).activeOrganizationId ?? null,
    sessionId: s.session.id,
  }
}

/**
 * Requires a signed-in merchant. Adds `session` to the context. Access tokens never pass:
 * account, sign-in and store-picking procedures are for people only.
 */
export const protectedProcedure = base.use(async ({ context, next }) => {
  if (context.apiPrincipal) {
    throw new ORPCError('FORBIDDEN', { message: 'Access tokens cannot use this' })
  }
  return next({ context: { session: await cookieSession(context) } })
})

/**
 * The base of store procedures (`can`, `canAny`, `canDetached`): a signed-in merchant, or an
 * access token whose member stands in for the session. `store.ts` then caps a token to its
 * areas and refuses it on procedures that name no permission.
 */
export const memberProcedure = base.use(async ({ context, next }) => {
  const p = context.apiPrincipal
  if (!p) return next({ context: { session: await cookieSession(context) } })
  context.log.set({ userId: p.userId, grantId: p.grantId })
  const session: Session = {
    user: { id: p.userId, email: p.email, name: p.userName },
    activeOrganizationId: p.organizationId,
    sessionId: `api:${p.grantId}`,
  }
  return next({ context: { session } })
})
