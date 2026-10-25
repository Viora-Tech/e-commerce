import type { BetterAuthPlugin } from 'better-auth'
import { APIError, createAuthEndpoint } from 'better-auth/api'
import { setSessionCookie } from 'better-auth/cookies'
import { constantTimeEqual } from 'better-auth/crypto'

export type ReviewerSignIn = { email: string; password: string }

/** The one answer for every refusal, so a wrong email and a wrong password look the same. */
const REFUSED = 'Wrong email or password.'

/** The endpoint path, also checked by the admin's sign-in log and rate limit. */
export const REVIEWER_SIGN_IN_PATH = '/sign-in/reviewer-password'

/**
 * Password sign-in for one app-store reviewer (`reviewerSignIn` in @commerce/config). Shopify
 * and Meta reviewers cannot receive a sign-in code, so the configured email may also sign in
 * with the configured password. It never creates a user: the reviewer must already be a member
 * (invited to the review store), and every other email is refused. No password is stored in the
 * database; Better Auth's own email-and-password sign-in stays off.
 */
export function reviewerPassword(reviewer: ReviewerSignIn) {
  return {
    id: 'reviewer-password',
    endpoints: {
      signInReviewerPassword: createAuthEndpoint(
        REVIEWER_SIGN_IN_PATH,
        { method: 'POST', requireHeaders: true },
        async (ctx) => {
          const body = (ctx.body ?? {}) as { email?: unknown; password?: unknown }
          const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
          const password = typeof body.password === 'string' ? body.password : ''
          // Both compared every time, so the timing does not say which one was wrong.
          const emailOk = constantTimeEqual(email, reviewer.email)
          const passwordOk = constantTimeEqual(password, reviewer.password)
          if (!emailOk || !passwordOk) {
            throw APIError.from('UNAUTHORIZED', { code: 'INVALID_CREDENTIALS', message: REFUSED })
          }
          const found = await ctx.context.internalAdapter.findUserByEmail(email)
          if (!found) {
            throw APIError.from('UNAUTHORIZED', { code: 'INVALID_CREDENTIALS', message: REFUSED })
          }
          const session = await ctx.context.internalAdapter.createSession(found.user.id)
          await setSessionCookie(ctx, { session, user: found.user })
          return ctx.json({ ok: true })
        },
      ),
    },
    rateLimit: [{ pathMatcher: (path) => path === REVIEWER_SIGN_IN_PATH, window: 60, max: 5 }],
  } satisfies BetterAuthPlugin
}
