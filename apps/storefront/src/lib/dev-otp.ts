/**
 * Development-only readback for storefront sign-in codes, mirroring the admin's.
 *
 * Nothing sends mail in development unless an email channel is configured, so the
 * code is printed and remembered here; `/api/dev/otp?email=` hands it back. Two
 * keys guard it: off in production builds and off unless `DEV_LOGIN_OTP=1`.
 */
const g = globalThis as unknown as { __storefrontDevOtp?: Map<string, string> }

export function devOtpEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.DEV_LOGIN_OTP === '1'
}

/**
 * The env flags alone are not enough: they can leak into a shared or
 * publicly-reachable deployment of a dev build, and this route hands out
 * working login codes. So the route also refuses any request whose `Host`
 * header is not localhost, unless the deployer explicitly widens that with
 * `DEV_OTP_ALLOWED_HOSTS` (comma-separated hostnames, no port, no scheme —
 * e.g. `DEV_OTP_ALLOWED_HOSTS=shop.dev.internal`). Mirrors the admin's.
 */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])

/** Strips a trailing `:port`, respecting IPv6's `[::1]:3100` bracket form. */
function hostnameOf(host: string): string {
  if (host.startsWith('[')) return host.slice(1, host.indexOf(']')).toLowerCase()
  return (host.split(':')[0] ?? '').toLowerCase()
}

export function devOtpHostAllowed(host: string | null | undefined): boolean {
  const hostname = host?.trim() ? hostnameOf(host.trim()) : ''
  if (!hostname) return false
  if (LOCAL_HOSTS.has(hostname)) return true
  const allowed = (process.env.DEV_OTP_ALLOWED_HOSTS ?? '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean)
  return allowed.includes(hostname)
}

const key = (storeId: string, email: string) => `${storeId}:${email.trim().toLowerCase()}`

export function rememberDevOtp(storeId: string, email: string, otp: string): void {
  if (!devOtpEnabled()) return
  g.__storefrontDevOtp ??= new Map()
  g.__storefrontDevOtp.set(key(storeId, email), otp)
}

export function recallDevOtp(storeId: string, email: string): string | null {
  if (!devOtpEnabled()) return null
  return g.__storefrontDevOtp?.get(key(storeId, email)) ?? null
}
