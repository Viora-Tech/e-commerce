/** SOURCE OF TRUTH: member sign-in log — WHAT: one row per merchant sign-in (method, device, masked IP, Cloudflare city when trusted), kept 90 days, for Account → Sign-in & security / WHY: Better Auth's sessions disappear on sign-out, so the history needs its own small table; the IP is masked before it is stored */
import { randomUUID } from 'node:crypto'
import { authSchema, type Db } from '@commerce/db'
import { and, eq, lt } from 'drizzle-orm'

export type SignInMethod = 'email_otp' | 'passkey' | 'google' | 'other'

/** How long a member's sign-in history is kept. */
const KEEP_DAYS = 90

/**
 * An IP with its last part hidden: IPv4 keeps three octets ("203.0.113.x"), IPv6 its first
 * three groups ("2001:db8:85a3::x"). Enough to tell "my office" from "somewhere else", not
 * enough to point at one connection. Null when there is no IP (tracking off).
 */
export function maskIp(ip: string | null | undefined): string | null {
  const value = ip?.trim()
  if (!value) return null
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}$/.exec(value)
  if (v4) return `${v4[1]}.${v4[2]}.${v4[3]}.x`
  if (value.includes(':')) {
    const groups = value.split(':').filter(Boolean).slice(0, 3)
    return groups.length ? `${groups.join(':')}::x` : null
  }
  return null
}

/** Which way they signed in, from the Better Auth endpoint that opened the session. */
export function signInMethod(path: string | null | undefined): SignInMethod {
  if (path?.startsWith('/sign-in/email-otp')) return 'email_otp'
  if (path?.startsWith('/passkey/')) return 'passkey'
  if (path === '/callback/google') return 'google'
  return 'other'
}

/** A proxy header value, trimmed and capped; null when absent or blank. */
function headerValue(headers: Headers | undefined, name: string, max: number): string | null {
  const value = headers?.get(name)?.trim()
  return value ? value.slice(0, max) : null
}

/** What Better Auth's session hook hands over (`MerchantAuthOptions.onSignIn`). */
export type SignInRecord = {
  userId: string
  sessionId: string
  path: string | null | undefined
  ipAddress: string | null | undefined
  userAgent: string | null | undefined
  headers: Headers | undefined
  /** Only Cloudflare's own visitor-location headers are believed, and only behind it. */
  trustLocation: boolean
}

/** Writes one sign-in and drops this member's rows older than `KEEP_DAYS`. */
export async function recordMemberSignIn(db: Db, input: SignInRecord): Promise<void> {
  await db.insert(authSchema.memberSignIn).values({
    id: randomUUID(),
    userId: input.userId,
    sessionId: input.sessionId,
    method: signInMethod(input.path),
    ipMasked: maskIp(input.ipAddress),
    userAgent: input.userAgent?.slice(0, 512) ?? null,
    city: input.trustLocation ? headerValue(input.headers, 'cf-ipcity', 80) : null,
    country: input.trustLocation ? headerValue(input.headers, 'cf-ipcountry', 2) : null,
  })
  await db
    .delete(authSchema.memberSignIn)
    .where(
      and(
        eq(authSchema.memberSignIn.userId, input.userId),
        lt(authSchema.memberSignIn.createdAt, new Date(Date.now() - KEEP_DAYS * 86_400_000)),
      ),
    )
}
