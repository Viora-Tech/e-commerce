/**
 * Better Auth routes the admin never exposes over HTTP (see `api/auth/[...all]/route.ts`).
 * The server still calls them through `auth.api` where the admin API wraps them:
 * - `/organization/create`: only `onboarding.create`, which checks the signup gate.
 * - `/email-otp/request-email-change`, `/email-otp/change-email`: only `account.*EmailChange`,
 *   which add rate limits and tell the old address; calling Better Auth directly would skip both.
 * - `/update-user`: profile changes go through `account.updateProfile` (checked name and phone).
 * - `/list-sessions`: hands every session token (this one's too) to page scripts;
 *   `account.sessions` lists devices without tokens.
 */
const BLOCKED_AUTH_PATHS = [
  '/organization/create',
  '/email-otp/request-email-change',
  '/email-otp/change-email',
  '/update-user',
  '/list-sessions',
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
