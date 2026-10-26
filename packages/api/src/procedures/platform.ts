import { loadEnv } from '@commerce/config'
import {
  isPlatformStaffEmail,
  type PlatformActor,
  recordPlatformAccess,
  sessionUsedPasskey,
} from '@commerce/core'
import type { Db } from '@commerce/db'
import { ORPCError } from '@orpc/server'
import { base, type SessionContext } from './base'
import { remember } from './request-memo'

/** What a handler behind `platformProcedure` sees on top of the session. */
export type PlatformContext = SessionContext & {
  platform: {
    /** The owner connection. Read through `platformRead` only. */
    db: Db
    actor: PlatformActor
    /** Writes one row to the console's access log. Call it once per read, before returning. */
    audit: (
      action: string,
      opts?: { storeId?: string | null; target?: string | null },
    ) => Promise<void>
  }
}

/** The one answer for anyone who is not platform staff: the console does not exist for them. */
const notFound = () => new ORPCError('NOT_FOUND', { message: 'Not found' })

/**
 * The platform console (`platform.*`): Koomerce staff only, never a store member as such.
 * Every check fails the same way, NOT_FOUND, so the console's routes cannot be discovered:
 *
 * 1. a cookie session (access tokens and MCP clients never pass: they carry `apiPrincipal`,
 *    and the hosts that serve them do not pass `platformDb` either);
 * 2. the email is on `PLATFORM_ADMIN_EMAILS`;
 * 3. this session was opened with a passkey (the second factor);
 * 4. the host passed the owner connection (`platformDb`).
 */
export const platformProcedure = base.use(async ({ context, next }) => {
  if (context.apiPrincipal || !context.platformDb) throw notFound()
  const s = await remember(context.memo, 'session', () =>
    context.auth.api.getSession({ headers: context.headers }),
  )
  if (!s) throw notFound()
  const staff = context.platformStaff ?? loadEnv(process.env).PLATFORM_ADMIN_EMAILS
  if (!isPlatformStaffEmail(s.user.email, staff)) throw notFound()
  const owner = context.platformDb
  if (!(await sessionUsedPasskey(owner, s.user.id, s.session.id))) throw notFound()

  context.log.set({ userId: s.user.id, platform: true })
  const actor: PlatformActor = { userId: s.user.id, email: s.user.email }
  const audit: PlatformContext['platform']['audit'] = (action, opts) =>
    recordPlatformAccess(owner, {
      actor,
      action,
      storeId: opts?.storeId ?? null,
      target: opts?.target ?? null,
    })
  return next({
    context: {
      session: {
        user: { id: s.user.id, email: s.user.email, name: s.user.name },
        activeOrganizationId:
          (s.session as { activeOrganizationId?: string | null }).activeOrganizationId ?? null,
        sessionId: s.session.id,
      },
      platform: { db: owner, actor, audit },
    },
  })
})
