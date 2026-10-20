/** SOURCE OF TRUTH: shopper login tickets — WHAT: mint and redeem the single-use hand-off from the platform login domain to the store's domain (bound to the store, the exact return URL and the starting browser), and emailed magic links / WHY: a hand-off token that could be replayed, used on another store, sent to another host or planted in someone else's browser would sign the wrong person in */

import { customer, customerLoginTicket } from '@commerce/db'
import { safeEqual } from '@commerce/payments'
import { and, desc, eq, gt, isNull, lt, sql } from 'drizzle-orm'
import { normaliseLoginEmail } from '../accounts/auth'
import type { StoreContext } from '../context'
import { recordCustomerChange } from '../customers/changes'
import type { ShopperIdentity } from './identities'
import {
  checkHandoffToken,
  HANDOFF_TTL_MS,
  type HandoffPayload,
  randomToken,
  safeNextPath,
  sha256Hex,
  signToken,
} from './tokens'

export type HandoffInput = {
  /**
   * `ready`: sign in as `customerId`. `verify_email`: confirm `identity.email` with a code
   * first. `connect`: add `identity` to `customerId`, once the store's domain has checked
   * the browser and that `customerId` is the one signed in there (stored as `ready` with
   * the identity attached).
   */
  status: 'ready' | 'verify_email' | 'connect'
  customerId: string | null
  identity?: ShopperIdentity | undefined
  returnUrl: string
  browserHash: string
  nextPath: string
  remember: boolean
}

/** Write the ticket and sign the token that points at it. The token carries no customer. */
export async function mintHandoff(
  ctx: StoreContext,
  input: HandoffInput,
  secret: string,
  now: Date = new Date(),
): Promise<string> {
  const jti = randomToken()
  const expiresAt = new Date(now.getTime() + HANDOFF_TTL_MS)
  await ctx.tx.insert(customerLoginTicket).values({
    storeId: ctx.storeId,
    kind: 'handoff',
    tokenHash: sha256Hex(jti),
    status: input.status === 'connect' ? 'ready' : input.status,
    customerId: input.customerId,
    returnUrl: input.returnUrl,
    browserHash: input.browserHash,
    nextPath: safeNextPath(input.nextPath),
    remember: input.remember,
    provider: input.identity?.provider ?? null,
    subject: input.identity?.subject ?? null,
    email: input.identity?.email ?? null,
    name: input.identity?.name ?? null,
    expiresAt,
    createdAt: now,
  })
  // Housekeeping: this store's dead tickets go with each new one.
  await ctx.tx.delete(customerLoginTicket).where(lt(customerLoginTicket.expiresAt, now))
  const payload: HandoffPayload = {
    v: 1,
    s: ctx.storeId,
    r: input.returnUrl,
    j: jti,
    e: expiresAt.getTime(),
  }
  return signToken(payload, secret, 'handoff')
}

export type RedeemResult =
  | {
      ok: true
      status: 'ready'
      customerId: string
      nextPath: string
      remember: boolean
    }
  | {
      ok: true
      status: 'verify_email'
      identity: ShopperIdentity
      nextPath: string
      remember: boolean
    }
  | {
      ok: true
      status: 'connect'
      customerId: string
      identity: ShopperIdentity
      nextPath: string
      remember: boolean
    }
  | {
      ok: false
      reason:
        | 'malformed'
        | 'tampered'
        | 'expired'
        | 'wrong_store'
        | 'wrong_return'
        | 'used'
        | 'wrong_browser'
    }

/**
 * Redeem a hand-off on the store's domain. The ticket is deleted in the same statement
 * that reads it, so a second use finds nothing (`used`), and a ticket opened by the
 * wrong browser is spent too, so a link someone planted cannot be retried.
 */
export async function redeemHandoff(
  ctx: StoreContext,
  token: unknown,
  expect: { secret: string; returnUrl: string; browserValue: string | null; now?: Date },
): Promise<RedeemResult> {
  const now = expect.now ?? new Date()
  const checked = checkHandoffToken(token, {
    secret: expect.secret,
    storeId: ctx.storeId,
    returnUrl: expect.returnUrl,
    now,
  })
  if (!checked.ok) return checked
  const [row] = await ctx.tx
    .delete(customerLoginTicket)
    .where(
      and(
        eq(customerLoginTicket.tokenHash, sha256Hex(checked.jti)),
        eq(customerLoginTicket.kind, 'handoff'),
      ),
    )
    .returning()
  if (!row) return { ok: false, reason: 'used' }
  if (row.expiresAt.getTime() <= now.getTime()) return { ok: false, reason: 'expired' }
  if (row.returnUrl !== expect.returnUrl) return { ok: false, reason: 'wrong_return' }
  if (
    !expect.browserValue ||
    !row.browserHash ||
    !safeEqual(sha256Hex(expect.browserValue), row.browserHash)
  ) {
    return { ok: false, reason: 'wrong_browser' }
  }
  const nextPath = safeNextPath(row.nextPath)
  if (row.status === 'verify_email' && row.provider && row.subject && row.email) {
    return {
      ok: true,
      status: 'verify_email',
      identity: {
        provider: row.provider,
        subject: row.subject,
        email: row.email,
        emailVerified: false,
        name: row.name,
      },
      nextPath,
      remember: row.remember,
    }
  }
  if (row.status !== 'ready' || !row.customerId) return { ok: false, reason: 'malformed' }
  if (row.provider && row.subject) {
    return {
      ok: true,
      status: 'connect',
      customerId: row.customerId,
      identity: {
        provider: row.provider,
        subject: row.subject,
        email: row.email,
        emailVerified: false,
        name: row.name,
      },
      nextPath,
      remember: row.remember,
    }
  }
  return { ok: true, status: 'ready', customerId: row.customerId, nextPath, remember: row.remember }
}

/** A magic link works for 15 minutes, once. */
const MAGIC_LINK_TTL_MS = 15 * 60 * 1000
const MAGIC_LINK_RESEND_MS = 30 * 1000

export type MagicLinkRequest =
  | { ok: true; email: string; token: string }
  | { ok: false; reason: 'invalid_email' | 'too_soon' }

/**
 * Mint a sign-in link for an email. Like the email code, it works for emails that are
 * not customers yet. Only one link per email is live: a new one replaces the last.
 */
export async function requestMagicLink(
  ctx: StoreContext,
  rawEmail: unknown,
  opts: { nextPath: string; remember: boolean },
  now: Date = new Date(),
): Promise<MagicLinkRequest> {
  const email = normaliseLoginEmail(rawEmail)
  if (!email) return { ok: false, reason: 'invalid_email' }
  const live = and(eq(customerLoginTicket.kind, 'magic_link'), eq(customerLoginTicket.email, email))
  const [last] = await ctx.tx
    .select({ createdAt: customerLoginTicket.createdAt })
    .from(customerLoginTicket)
    .where(live)
    .orderBy(desc(customerLoginTicket.createdAt))
    .limit(1)
  if (last && now.getTime() - last.createdAt.getTime() < MAGIC_LINK_RESEND_MS) {
    return { ok: false, reason: 'too_soon' }
  }
  await ctx.tx.delete(customerLoginTicket).where(live)
  const token = randomToken()
  await ctx.tx.insert(customerLoginTicket).values({
    storeId: ctx.storeId,
    kind: 'magic_link',
    tokenHash: sha256Hex(token),
    status: 'pending',
    email,
    nextPath: safeNextPath(opts.nextPath),
    remember: opts.remember,
    expiresAt: new Date(now.getTime() + MAGIC_LINK_TTL_MS),
    createdAt: now,
  })
  return { ok: true, email, token }
}

export type MagicLinkRedeem =
  | { ok: true; customerId: string; nextPath: string; remember: boolean }
  | { ok: false; reason: 'invalid' | 'expired' }

const LINK_TOKEN = /^[A-Za-z0-9_-]{40,60}$/

/**
 * Spend a magic link: the shopper proved the inbox, so the customer with that email is
 * found or created, exactly as an email code does.
 */
export async function redeemMagicLink(
  ctx: StoreContext,
  token: unknown,
  now: Date = new Date(),
): Promise<MagicLinkRedeem> {
  if (typeof token !== 'string' || !LINK_TOKEN.test(token)) return { ok: false, reason: 'invalid' }
  const [row] = await ctx.tx
    .delete(customerLoginTicket)
    .where(
      and(
        eq(customerLoginTicket.tokenHash, sha256Hex(token)),
        eq(customerLoginTicket.kind, 'magic_link'),
      ),
    )
    .returning()
  if (!row?.email) return { ok: false, reason: 'invalid' }
  if (row.expiresAt.getTime() <= now.getTime()) return { ok: false, reason: 'expired' }
  const [cu] = await ctx.tx
    .insert(customer)
    .values({ storeId: ctx.storeId, email: row.email })
    .onConflictDoUpdate({ target: [customer.storeId, customer.email], set: { updatedAt: now } })
    // `xmax = 0`: the row was inserted, not updated by the conflict.
    .returning({
      id: customer.id,
      anonymisedAt: customer.anonymisedAt,
      inserted: sql<boolean>`(xmax = 0)`,
    })
  if (!cu || cu.anonymisedAt) return { ok: false, reason: 'invalid' }
  if (cu.inserted) await recordCustomerChange(ctx.tx, ctx.storeId, cu.id, 'created')
  return {
    ok: true,
    customerId: cu.id,
    nextPath: safeNextPath(row.nextPath),
    remember: row.remember,
  }
}

/** Whether a live magic link exists for this token (the landing page checks before showing its button). */
export async function magicLinkIsLive(
  ctx: StoreContext,
  token: unknown,
  now: Date = new Date(),
): Promise<boolean> {
  if (typeof token !== 'string' || !LINK_TOKEN.test(token)) return false
  const [row] = await ctx.tx
    .select({ id: customerLoginTicket.id })
    .from(customerLoginTicket)
    .where(
      and(
        eq(customerLoginTicket.tokenHash, sha256Hex(token)),
        eq(customerLoginTicket.kind, 'magic_link'),
        gt(customerLoginTicket.expiresAt, now),
        isNull(customerLoginTicket.customerId),
      ),
    )
  return Boolean(row)
}
