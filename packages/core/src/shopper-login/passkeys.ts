/** SOURCE OF TRUTH: shopper passkeys — WHAT: add a passkey to a signed-in shopper's account, sign in with one (WebAuthn, discoverable credentials), list and remove them; passkeys are registered on the store's own hostname (rpID) / WHY: a passkey is bound to one domain, so it must live on the domain the shopper actually uses, and a challenge that could be replayed or answered for another store would let the wrong person in */

import { customer, customerLoginTicket, customerPasskey } from '@commerce/db'
import {
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  generateAuthenticationOptions,
  generateRegistrationOptions,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server'
import { and, eq, isNull, lt } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { randomToken, sha256Hex } from './tokens'

/*
 * @simplewebauthn/server 13 (MIT), the library Better Auth's passkey plugin
 * (`@better-auth/passkey`, https://www.better-auth.com/docs/plugins/passkey) is built on.
 * We call it directly because that plugin stores passkeys against Better Auth's global
 * users, and shoppers are per-store customers. Like the plugin: no attestation, resident
 * key required (usernameless sign-in). Unlike its default, user verification is REQUIRED
 * (security audit D-04): a passkey is the whole sign-in, so the authenticator must check
 * the shopper (fingerprint, face, PIN), not only that a key is present.
 *
 * Challenges live server-side (security audit D-04): a `customer_login_ticket` row per
 * ceremony (`passkey_register` / `passkey_login`) holding the challenge, the rpID and, when
 * registering, the customer; the browser only keeps a random cookie whose hash finds the
 * row. Verifying deletes the row first (single use), and it lives five minutes.
 *
 * rpID decision: the store's own hostname, the one the shopper is on. A passkey made on
 * `shop.example.in` works only there; if the store moves to another domain, the shopper
 * signs in another way once and adds a passkey again. See developer docs, "Shopper login".
 */

/** A challenge is good for 5 minutes. */
const CHALLENGE_TTL_MS = 5 * 60 * 1000

/** What the browser's cookie holds: the random handle of one challenge row. */
const HANDLE = /^[A-Za-z0-9_-]{40,60}$/

type CeremonyKind = 'passkey_register' | 'passkey_login'

export type PasskeyContext = {
  /** The store hostname, used as rpID. */
  rpId: string
  /** The page origin, e.g. `https://shop.example.in` (`http://…:3100` in development). */
  origin: string
}

/** Keep a challenge for this browser; returns the handle the caller puts in a cookie. */
async function storeChallenge(
  ctx: StoreContext,
  input: { kind: CeremonyKind; challenge: string; rpId: string; customerId?: string | undefined },
  now: Date,
): Promise<string> {
  const handle = randomToken()
  // Housekeeping: this store's dead tickets go with each new one.
  await ctx.tx.delete(customerLoginTicket).where(lt(customerLoginTicket.expiresAt, now))
  await ctx.tx.insert(customerLoginTicket).values({
    storeId: ctx.storeId,
    kind: input.kind,
    tokenHash: sha256Hex(handle),
    status: 'pending',
    customerId: input.customerId ?? null,
    returnUrl: input.rpId,
    challenge: input.challenge,
    expiresAt: new Date(now.getTime() + CHALLENGE_TTL_MS),
    createdAt: now,
  })
  return handle
}

/**
 * Spend the challenge behind a cookie handle: deleted in the same statement that reads it,
 * so a second answer (or a replay) finds nothing. Only this store's rows are visible (RLS).
 */
async function takeChallenge(
  ctx: StoreContext,
  handle: unknown,
  expect: { kind: CeremonyKind; rpId: string; now: Date },
): Promise<{ challenge: string; customerId: string | null } | null> {
  if (typeof handle !== 'string' || !HANDLE.test(handle)) return null
  const [row] = await ctx.tx
    .delete(customerLoginTicket)
    .where(
      and(
        eq(customerLoginTicket.tokenHash, sha256Hex(handle)),
        eq(customerLoginTicket.kind, expect.kind),
      ),
    )
    .returning()
  if (!row?.challenge || row.returnUrl !== expect.rpId) return null
  if (row.expiresAt.getTime() <= expect.now.getTime()) return null
  return { challenge: row.challenge, customerId: row.customerId }
}

/** Options for adding a passkey, and the challenge handle the caller keeps in a cookie. */
export async function passkeyRegistrationOptions(
  ctx: StoreContext,
  customerId: string,
  input: PasskeyContext & { storeName: string },
  now: Date = new Date(),
): Promise<{ options: PublicKeyCredentialCreationOptionsJSON; challenge: string } | null> {
  const [cu] = await ctx.tx
    .select({ email: customer.email, name: customer.name })
    .from(customer)
    .where(and(eq(customer.id, customerId), isNull(customer.anonymisedAt)))
  if (!cu) return null
  const existing = await ctx.tx
    .select({ credentialId: customerPasskey.credentialId, transports: customerPasskey.transports })
    .from(customerPasskey)
    .where(and(eq(customerPasskey.customerId, customerId), eq(customerPasskey.rpId, input.rpId)))
  const options = await generateRegistrationOptions({
    rpName: input.storeName || input.rpId,
    rpID: input.rpId,
    userName: cu.email ?? cu.name ?? 'Customer',
    userDisplayName: cu.name ?? cu.email ?? 'Customer',
    userID: new TextEncoder().encode(customerId),
    attestationType: 'none',
    excludeCredentials: existing.map((c) => ({
      id: c.credentialId,
      transports: c.transports as AuthenticatorTransportFuture[],
    })),
    authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
  })
  const challenge = await storeChallenge(
    ctx,
    { kind: 'passkey_register', challenge: options.challenge, rpId: input.rpId, customerId },
    now,
  )
  return { options, challenge }
}

/** Check the browser's answer and store the new passkey. */
export async function verifyPasskeyRegistration(
  ctx: StoreContext,
  customerId: string,
  input: PasskeyContext & { response: unknown; challenge: unknown; name?: string | undefined },
  now: Date = new Date(),
): Promise<{ ok: true } | { ok: false; reason: 'invalid' }> {
  const kept = await takeChallenge(ctx, input.challenge, {
    kind: 'passkey_register',
    rpId: input.rpId,
    now,
  })
  if (!kept || kept.customerId !== customerId) return { ok: false, reason: 'invalid' }
  let result: Awaited<ReturnType<typeof verifyRegistrationResponse>>
  try {
    result = await verifyRegistrationResponse({
      response: input.response as RegistrationResponseJSON,
      expectedChallenge: kept.challenge,
      expectedOrigin: input.origin,
      expectedRPID: input.rpId,
      requireUserVerification: true,
    })
  } catch {
    return { ok: false, reason: 'invalid' }
  }
  if (!result.verified) return { ok: false, reason: 'invalid' }
  const info = result.registrationInfo
  await ctx.tx
    .insert(customerPasskey)
    .values({
      storeId: ctx.storeId,
      customerId,
      credentialId: info.credential.id,
      publicKey: Buffer.from(info.credential.publicKey).toString('base64url'),
      counter: info.credential.counter,
      transports: info.credential.transports ?? [],
      rpId: input.rpId,
      deviceType: info.credentialDeviceType,
      backedUp: info.credentialBackedUp,
      name: input.name?.slice(0, 80) || null,
      createdAt: now,
    })
    .onConflictDoNothing({ target: [customerPasskey.storeId, customerPasskey.credentialId] })
  return { ok: true }
}

/** Options for signing in with any passkey saved on this device for this store. */
export async function passkeyLoginOptions(
  ctx: StoreContext,
  input: PasskeyContext,
  now: Date = new Date(),
): Promise<{ options: PublicKeyCredentialRequestOptionsJSON; challenge: string }> {
  const options = await generateAuthenticationOptions({
    rpID: input.rpId,
    userVerification: 'required',
  })
  const challenge = await storeChallenge(
    ctx,
    { kind: 'passkey_login', challenge: options.challenge, rpId: input.rpId },
    now,
  )
  return { options, challenge }
}

/** Check a passkey sign-in; the customer whose passkey signed it, or null. */
export async function verifyPasskeyLogin(
  ctx: StoreContext,
  input: PasskeyContext & { response: unknown; challenge: unknown },
  now: Date = new Date(),
): Promise<{ ok: true; customerId: string } | { ok: false; reason: 'invalid' }> {
  const kept = await takeChallenge(ctx, input.challenge, { kind: 'passkey_login', rpId: input.rpId, now })
  const response = input.response as AuthenticationResponseJSON | null
  if (!kept || !response || typeof response.id !== 'string') {
    return { ok: false, reason: 'invalid' }
  }
  const [row] = await ctx.tx
    .select({
      id: customerPasskey.id,
      customerId: customerPasskey.customerId,
      publicKey: customerPasskey.publicKey,
      counter: customerPasskey.counter,
      transports: customerPasskey.transports,
      anonymisedAt: customer.anonymisedAt,
    })
    .from(customerPasskey)
    .innerJoin(customer, eq(customer.id, customerPasskey.customerId))
    .where(and(eq(customerPasskey.credentialId, response.id), eq(customerPasskey.rpId, input.rpId)))
  if (!row || row.anonymisedAt) return { ok: false, reason: 'invalid' }
  let result: Awaited<ReturnType<typeof verifyAuthenticationResponse>>
  try {
    result = await verifyAuthenticationResponse({
      response,
      expectedChallenge: kept.challenge,
      expectedOrigin: input.origin,
      expectedRPID: input.rpId,
      credential: {
        id: response.id,
        publicKey: new Uint8Array(Buffer.from(row.publicKey, 'base64url')),
        counter: row.counter,
        transports: row.transports as AuthenticatorTransportFuture[],
      },
      requireUserVerification: true,
    })
  } catch {
    return { ok: false, reason: 'invalid' }
  }
  if (!result.verified) return { ok: false, reason: 'invalid' }
  await ctx.tx
    .update(customerPasskey)
    .set({ counter: result.authenticationInfo.newCounter, lastUsedAt: now })
    .where(eq(customerPasskey.id, row.id))
  return { ok: true, customerId: row.customerId }
}

export type SavedPasskey = {
  id: string
  name: string | null
  rpId: string
  createdAt: Date
  lastUsedAt: Date | null
}

export async function listCustomerPasskeys(
  ctx: StoreContext,
  customerId: string,
): Promise<SavedPasskey[]> {
  return ctx.tx
    .select({
      id: customerPasskey.id,
      name: customerPasskey.name,
      rpId: customerPasskey.rpId,
      createdAt: customerPasskey.createdAt,
      lastUsedAt: customerPasskey.lastUsedAt,
    })
    .from(customerPasskey)
    .where(eq(customerPasskey.customerId, customerId))
    .orderBy(customerPasskey.createdAt)
}

export async function removeCustomerPasskey(
  ctx: StoreContext,
  customerId: string,
  passkeyId: string,
): Promise<boolean> {
  const rows = await ctx.tx
    .delete(customerPasskey)
    .where(and(eq(customerPasskey.id, passkeyId), eq(customerPasskey.customerId, customerId)))
    .returning({ id: customerPasskey.id })
  return rows.length > 0
}
