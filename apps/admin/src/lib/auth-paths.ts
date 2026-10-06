/** Better Auth routes the admin never exposes over HTTP (see `api/auth/[...all]/route.ts`). */
const BLOCKED_AUTH_PATHS = ['/organization/create']

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
