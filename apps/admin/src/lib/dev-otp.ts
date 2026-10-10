/**
 * Development-only delivery for login codes.
 *
 * Nothing sends mail in development: `sendOtp` prints the code to the admin
 * server's stdout. When that terminal is not the one in front of you the code is
 * effectively lost for the ten minutes it lives, so the login page reads it back
 * from here instead.
 *
 * The guard is deliberately two keys rather than one. This hands out working login
 * codes, so a single misfiled env var must not be enough to expose it: it is off
 * in production builds and off unless `DEV_LOGIN_OTP=1` was set on purpose.
 */
const g = globalThis as unknown as { __devOtp?: Map<string, string> }

/**
 * Whether a code may be read back, by anyone, at all. A production build answers no before
 * any flag is read: Next inlines `process.env.NODE_ENV` at build time, so in a production
 * bundle this is `return false` and the readback code is dead.
 */
export function devOtpEnabled(): boolean {
  if (process.env.NODE_ENV === 'production') return false
  return process.env.DEV_LOGIN_OTP === '1'
}

/**
 * Whether a sign-in code or invite link may be printed to the server log when no email
 * account is set up. Never in production: anyone who can read the logs (the host, a log
 * drain, error tracking) could sign in as any merchant or join their store with it.
 */
export function mayPrintCodes(): boolean {
  return process.env.NODE_ENV !== 'production'
}

/**
 * The env flags alone are not enough: they can leak into a shared or
 * publicly-reachable deployment of a dev build, and this route hands out
 * working login codes. So the route also refuses any request whose `Host`
 * header is not localhost, unless the deployer explicitly widens that with
 * `DEV_OTP_ALLOWED_HOSTS` (comma-separated hostnames, no port, no scheme —
 * e.g. `DEV_OTP_ALLOWED_HOSTS=admin.dev.internal`).
 */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])

/** Strips a trailing `:port`, respecting IPv6's `[::1]:3200` bracket form. */
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

/** Remembers the newest code handed to an email. No-op unless the handoff is on. */
export function rememberDevOtp(email: string, otp: string): void {
  if (!devOtpEnabled()) return
  g.__devOtp ??= new Map()
  g.__devOtp.set(email.trim().toLowerCase(), otp)
}

/** The code last handed to this email, or null. */
export function recallDevOtp(email: string): string | null {
  if (!devOtpEnabled()) return null
  return g.__devOtp?.get(email.trim().toLowerCase()) ?? null
}
