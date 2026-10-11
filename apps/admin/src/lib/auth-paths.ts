/**
 * Better Auth routes the admin never exposes over HTTP (see `api/auth/[...all]/route.ts`).
 * The server still calls them through `auth.api` where the admin API wraps them:
 * - `/organization/create`: only `onboarding.create`, which checks the signup gate.
 * - `/email-otp/request-email-change`, `/email-otp/change-email`: only `account.*EmailChange`,
 *   which add rate limits and tell the old address; calling Better Auth directly would skip both.
 * - `/update-user`: profile changes go through `account.updateProfile` (checked name and phone).
 * - `/list-sessions`: hands every session token (this one's too) to page scripts;
 *   `account.sessions` lists devices without tokens.
 * Google sign-in needs only `/sign-in/social` and `/callback/google`. The account routes below
 * are refused because nothing in the admin uses them:
 * - `/link-social`: linking happens only by signing in with Google on a verified, matching
 *   email; an explicit link would let a signed-in session attach any Google account.
 * - `/unlink-account`: Account → Sign-in & security only shows the link.
 * - `/list-accounts`: `account.security` says whether Google is linked.
 * - `/get-access-token`, `/refresh-token`, `/account-info`: would hand Google's tokens or
 *   profile to page scripts.
 */
const BLOCKED_AUTH_PATHS = [
  '/organization/create',
  '/email-otp/request-email-change',
  '/email-otp/change-email',
  '/update-user',
  '/list-sessions',
  '/link-social',
  '/unlink-account',
  '/list-accounts',
  '/get-access-token',
  '/refresh-token',
  '/account-info',
]

/** True for a request path the admin auth route must refuse, however it is spelled. */
export function isBlockedAuthPath(pathname: string): boolean {
  let path = pathname
  try {
    path = decodeURIComponent(pathname)
  } catch {
    return true
  }
  const normal = path
    .replace(/\/{2,}/g, '/')
    .replace(/\/+$/, '')
    .toLowerCase()
  return BLOCKED_AUTH_PATHS.some((p) => normal.endsWith(p))
}
