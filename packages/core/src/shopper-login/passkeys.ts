/** SOURCE OF TRUTH: shopper passkeys — WHAT: add a passkey to a signed-in shopper's account, sign in with one (WebAuthn, discoverable credentials), list and remove them; passkeys are registered on the store's own hostname (rpID) / WHY: a passkey is bound to one domain, so it must live on the domain the shopper actually uses, and a challenge that could be replayed or answered for another store would let the wrong person in */

import { customer, customerPasskey } from '@commerce/db'
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
import { and, eq, isNull } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { openToken, signToken } from './tokens'

/*
 * @simplewebauthn/server 13 (MIT), the library Better Auth's passkey plugin
 * (`@better-auth/passkey`, https://www.better-auth.com/docs/plugins/passkey) is built on.
 * We call it directly because that plugin stores passkeys against Better Auth's global
 * users, and shoppers are per-store customers. Same defaults as the plugin: no
 * attestation, resident key required (usernameless sign-in), user verification preferred.
 *
 * rpID decision: the store's own hostname, the one the shopper is on. A passkey made on
 * `shop.example.in` works only there; if the store moves to another domain, the shopper
 * signs in another way once and adds a passkey again. See developer docs, "Shopper login".
 */

/** A challenge is good for 5 minutes. */
const CHALLENGE_TTL_MS = 5 * 60 * 1000

type ChallengePayload = {
  /** The challenge the browser must sign. */
  c: string
  k: 'register' | 'login'
  /** Store id and the hostname (rpID) the ceremony runs on. */
  s: string
  h: string
  /** For register: the signed-in customer. */
  u?: string | undefined
  e: number
}

export type PasskeyContext = {
  /** The store hostname, used as rpID. */
  rpId: string
  /** The page origin, e.g. `https://shop.example.in` (`http://…:3100` in development). */
  origin: string
  secret: string
}

const sealChallenge = (p: ChallengePayload, secret: string) => signToken(p, secret, 'passkey')

function openChallenge(
  token: unknown,
  expect: { kind: ChallengePayload['k']; storeId: string; rpId: string; secret: string; now: Date },
): ChallengePayload | null {
  const opened = openToken<ChallengePayload>(token, expect.secret, 'passkey', expect.now)
  if (!opened.ok) return null
  const p = opened.payload
  if (p.k !== expect.kind || p.s !== expect.storeId || p.h !== expect.rpId) return null
  return p
}

/** Options for adding a passkey, and the sealed challenge the caller keeps in a cookie. */
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
    authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
  })
  const challenge = sealChallenge(
    {
      c: options.challenge,
      k: 'register',
      s: ctx.storeId,
      h: input.rpId,
      u: customerId,
      e: now.getTime() + CHALLENGE_TTL_MS,
    },
    input.secret,
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
  const sealed = openChallenge(input.challenge, {
    kind: 'register',
    storeId: ctx.storeId,
    rpId: input.rpId,
    secret: input.secret,
    now,
  })
  if (!sealed || sealed.u !== customerId) return { ok: false, reason: 'invalid' }
  let result: Awaited<ReturnType<typeof verifyRegistrationResponse>>
  try {
    result = await verifyRegistrationResponse({
      response: input.response as RegistrationResponseJSON,
      expectedChallenge: sealed.c,
      expectedOrigin: input.origin,
      expectedRPID: input.rpId,
      requireUserVerification: false,
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
  storeId: string,
  input: PasskeyContext,
  now: Date = new Date(),
): Promise<{ options: PublicKeyCredentialRequestOptionsJSON; challenge: string }> {
  const options = await generateAuthenticationOptions({
    rpID: input.rpId,
    userVerification: 'preferred',
  })
  const challenge = sealChallenge(
    {
      c: options.challenge,
      k: 'login',
      s: storeId,
      h: input.rpId,
      e: now.getTime() + CHALLENGE_TTL_MS,
    },
    input.secret,
  )
  return { options, challenge }
}

/** Check a passkey sign-in; the customer whose passkey signed it, or null. */
export async function verifyPasskeyLogin(
  ctx: StoreContext,
  input: PasskeyContext & { response: unknown; challenge: unknown },
  now: Date = new Date(),
): Promise<{ ok: true; customerId: string } | { ok: false; reason: 'invalid' }> {
  const sealed = openChallenge(input.challenge, {
    kind: 'login',
    storeId: ctx.storeId,
    rpId: input.rpId,
    secret: input.secret,
    now,
  })
  const response = input.response as AuthenticationResponseJSON | null
  if (!sealed || !response || typeof response.id !== 'string') {
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
      expectedChallenge: sealed.c,
      expectedOrigin: input.origin,
      expectedRPID: input.rpId,
      credential: {
        id: response.id,
        publicKey: new Uint8Array(Buffer.from(row.publicKey, 'base64url')),
        counter: row.counter,
        transports: row.transports as AuthenticatorTransportFuture[],
      },
      requireUserVerification: false,
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
