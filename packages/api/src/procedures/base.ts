import { ORPCError, os } from '@orpc/server'
import type { ApiContext } from '../context'

/** Public procedure. No session required. */
export const base = os.$context<ApiContext>()

type SessionUser = { id: string; email: string; name: string }
type Session = {
  user: SessionUser
  activeOrganizationId: string | null
  /** Better Auth's id for this browser's session (Account → Sessions marks it "This device"). */
  sessionId: string
}

/** What a handler behind `protectedProcedure` sees. */
export type SessionContext = ApiContext & { session: Session }

/** Requires a signed-in merchant. Adds `session` to the context. */
export const protectedProcedure = base.use(async ({ context, next }) => {
  const s = await context.auth.api.getSession({ headers: context.headers })
  if (!s) throw new ORPCError('UNAUTHORIZED', { message: 'Sign in required' })
  const session: Session = {
    user: { id: s.user.id, email: s.user.email, name: s.user.name },
    activeOrganizationId:
      (s.session as { activeOrganizationId?: string | null }).activeOrganizationId ?? null,
    sessionId: s.session.id,
  }
  return next({ context: { session } })
})
