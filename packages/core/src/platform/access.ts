/** SOURCE OF TRUTH: platform console access — WHAT: who counts as Koomerce staff, the read-only owner transaction every console query runs in, and the access log / WHY: the console reads across every store, so who may open it and what they looked at must live in one place */
import { authSchema, type Db, platformAccessLog, type StoreTx } from '@commerce/db'
import { and, desc, eq } from 'drizzle-orm'
import type { SignInMethod } from '../member-account/sign-ins'

/** A staff member using the platform console. */
export type PlatformActor = { userId: string; email: string }

/** One console read for the access log. */
export type PlatformAccessEntry = {
  actor: PlatformActor
  /** `overview.read`, `stores.list`, `stores.detail`, `users.list`, `audit.list` */
  action: string
  /** The store looked into, when the read was about one. */
  storeId?: string | null | undefined
  /** What was read inside it, or the filter used. Never personal data beyond ids and search words. */
  target?: string | null | undefined
}

const TARGET_MAX = 300

const PASSKEY: SignInMethod = 'passkey'

/**
 * True when `email` is on the platform staff list (`PLATFORM_ADMIN_EMAILS`, already lowercased
 * by the env schema). An empty list lets nobody in.
 */
export function isPlatformStaffEmail(
  email: string | null | undefined,
  allowlist: readonly string[],
): boolean {
  const value = email?.trim().toLowerCase()
  if (!value || allowlist.length === 0) return false
  return allowlist.includes(value)
}

/**
 * Whether this browser session was opened with a passkey: the platform console's second factor
 * (the auth stack has no TOTP; a passkey is phishing-resistant on its own). Read from the
 * sign-in log the auth hook writes for every new session. Platform-level table, any connection.
 */
export async function sessionUsedPasskey(
  db: Db,
  userId: string,
  sessionId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ method: authSchema.memberSignIn.method })
    .from(authSchema.memberSignIn)
    .where(
      and(
        eq(authSchema.memberSignIn.userId, userId),
        eq(authSchema.memberSignIn.sessionId, sessionId),
      ),
    )
    .orderBy(desc(authSchema.memberSignIn.createdAt))
    .limit(1)
  return row?.method === PASSKEY
}

/**
 * Runs `fn` in a READ ONLY transaction on the owner connection, so a console query sees every
 * store (no `app.store_id`) yet cannot change a row even by mistake. The platform console is the
 * one place that reads across stores (architecture "Sharding-readiness rules" exception): its
 * queries are explicit and live in this folder only.
 */
export async function platformRead<T>(owner: Db, fn: (tx: StoreTx) => Promise<T>): Promise<T> {
  return owner.transaction(async (tx) => fn(tx), { accessMode: 'read only' })
}

/** Writes one console read to the access log (owner connection; the app role has no grant). */
export async function recordPlatformAccess(owner: Db, entry: PlatformAccessEntry): Promise<void> {
  await owner.insert(platformAccessLog).values({
    actorUserId: entry.actor.userId,
    actorEmail: entry.actor.email.toLowerCase(),
    action: entry.action.slice(0, 80),
    storeId: entry.storeId ?? null,
    target: entry.target ? entry.target.slice(0, TARGET_MAX) : null,
  })
}
