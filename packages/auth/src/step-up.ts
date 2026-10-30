/**
 * Step-up re-authentication core (attack-catalog A5). An already-signed-in merchant re-verifies
 * with an OTP or a passkey before a sensitive action; a success stamps the SAME session's
 * `reauthenticated_at = now()` — no new session is minted. A guard (built on `stepUpAgeMs` /
 * `isFresh`) then treats a session as needing step-up once it falls outside the window.
 *
 * Merchants are platform-level (Better Auth owns `session`, `passkey`, `verification`; no RLS),
 * so these functions take the plain `Db` handle and write those tables directly, the way the
 * account service already does.
 *
 * Both factors are our own ceremonies, kept in the `verification` table under namespaced
 * identifiers so neither can be reached by Better Auth's own sign-in OTP or by any other flow:
 *
 *   - OTP: a six-digit code, stored as a SHA-256 hash with a short attempt cap (`step-up-otp:`),
 *     delivered by the caller. We do not reuse Better Auth's email-OTP, whose `type` is a fixed
 *     set and whose `email-verification` namespace already belongs to account deletion.
 *   - Passkey: a WebAuthn ceremony on `@simplewebauthn/server` — the library `@better-auth/passkey`
 *     is built on — because that plugin's verify always mints a fresh session, which step-up must
 *     not do. We read the credentials the plugin registered: `publicKey` is standard base64,
 *     `transports` a CSV string (`step-up-passkey:`).
 */
import { createHash, randomInt, randomUUID } from 'node:crypto'
import { authSchema, type Db } from '@commerce/db'
import {
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  generateAuthenticationOptions,
  type PublicKeyCredentialRequestOptionsJSON,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server'
import { and, eq } from 'drizzle-orm'

/** A step-up stays fresh for ten minutes; a sensitive action after that re-prompts. */
export const STEP_UP_WINDOW_MS = 10 * 60 * 1000

/** A step-up OTP is good for ten minutes — the same as the freshness it grants. */
const OTP_TTL_MS = 10 * 60 * 1000

/** A passkey challenge is good for five minutes. */
const CHALLENGE_TTL_MS = 5 * 60 * 1000

/** Wrong OTP guesses before the code is burned (defence in depth under the caller's rate limit). */
const OTP_MAX_ATTEMPTS = 5

const otpKey = (userId: string) => `step-up-otp:${userId}`
const challengeKey = (sessionId: string) => `step-up-passkey:${sessionId}`

const sha256Hex = (s: string) => createHash('sha256').update(s).digest('hex')

/** `@better-auth/passkey` keeps `transports` as a CSV string; `@simplewebauthn` wants an array. */
function splitTransports(csv: string | null): AuthenticatorTransportFuture[] | undefined {
  if (!csv) return undefined
  const parts = csv.split(',').filter(Boolean)
  return parts.length > 0 ? (parts as AuthenticatorTransportFuture[]) : undefined
}

/**
 * Stamp the current session's `reauthenticated_at`. Scoped to both the session id and the user
 * so a session can only ever bump its own row. Returns whether a row was updated.
 */
export async function markReauthenticated(
  db: Db,
  input: { sessionId: string; userId: string },
  now: Date = new Date(),
): Promise<boolean> {
  const rows = await db
    .update(authSchema.session)
    .set({ reauthenticatedAt: now })
    .where(
      and(eq(authSchema.session.id, input.sessionId), eq(authSchema.session.userId, input.userId)),
    )
    .returning({ id: authSchema.session.id })
  return rows.length > 0
}

/** True when a passkey is enrolled for this member — the start step prefers it over OTP. */
export async function hasPasskey(db: Db, userId: string): Promise<boolean> {
  const rows = await db
    .select({ id: authSchema.passkey.id })
    .from(authSchema.passkey)
    .where(eq(authSchema.passkey.userId, userId))
    .limit(1)
  return rows.length > 0
}

/**
 * Mint a step-up OTP for a member: a six-digit code, kept server-side as a SHA-256 hash (one
 * live code per member), and returned in the clear for the caller to deliver. Minting a fresh
 * code clears any earlier one and its attempt count.
 */
export async function createStepUpOtp(
  db: Db,
  userId: string,
  now: Date = new Date(),
): Promise<string> {
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
  const identifier = otpKey(userId)
  await db.delete(authSchema.verification).where(eq(authSchema.verification.identifier, identifier))
  await db.insert(authSchema.verification).values({
    id: randomUUID(),
    identifier,
    value: JSON.stringify({ hash: sha256Hex(code), attempts: 0 }),
    expiresAt: new Date(now.getTime() + OTP_TTL_MS),
    createdAt: now,
    updatedAt: now,
  })
  return code
}

/** Verify a step-up OTP and, on success, stamp the session. */
export async function verifyStepUpOtp(
  db: Db,
  input: { sessionId: string; userId: string; otp: string },
  now: Date = new Date(),
): Promise<{ ok: true } | { ok: false; reason: 'invalid' }> {
  const identifier = otpKey(input.userId)
  const [row] = await db
    .select({
      value: authSchema.verification.value,
      expiresAt: authSchema.verification.expiresAt,
    })
    .from(authSchema.verification)
    .where(eq(authSchema.verification.identifier, identifier))
  if (!row) return { ok: false, reason: 'invalid' }

  const burn = () =>
    db.delete(authSchema.verification).where(eq(authSchema.verification.identifier, identifier))

  if (row.expiresAt.getTime() <= now.getTime()) {
    await burn()
    return { ok: false, reason: 'invalid' }
  }
  let parsed: { hash?: unknown; attempts?: unknown }
  try {
    parsed = JSON.parse(row.value)
  } catch {
    await burn()
    return { ok: false, reason: 'invalid' }
  }
  const attempts = typeof parsed.attempts === 'number' ? parsed.attempts : 0
  if (typeof parsed.hash !== 'string' || attempts >= OTP_MAX_ATTEMPTS) {
    await burn()
    return { ok: false, reason: 'invalid' }
  }
  if (sha256Hex(input.otp) !== parsed.hash) {
    // A wrong guess costs an attempt; the code is burned once the cap is reached.
    if (attempts + 1 >= OTP_MAX_ATTEMPTS) await burn()
    else
      await db
        .update(authSchema.verification)
        .set({
          value: JSON.stringify({ hash: parsed.hash, attempts: attempts + 1 }),
          updatedAt: now,
        })
        .where(eq(authSchema.verification.identifier, identifier))
    return { ok: false, reason: 'invalid' }
  }
  await burn()
  await markReauthenticated(db, { sessionId: input.sessionId, userId: input.userId }, now)
  return { ok: true }
}

/** Keep one passkey challenge per session server-side; the browser never holds it. */
async function storeChallenge(
  db: Db,
  sessionId: string,
  rpId: string,
  challenge: string,
  now: Date,
): Promise<void> {
  const identifier = challengeKey(sessionId)
  // At most one live challenge per session: drop any earlier one before keeping the new one.
  await db.delete(authSchema.verification).where(eq(authSchema.verification.identifier, identifier))
  await db.insert(authSchema.verification).values({
    id: randomUUID(),
    identifier,
    value: JSON.stringify({ challenge, rpId }),
    expiresAt: new Date(now.getTime() + CHALLENGE_TTL_MS),
    createdAt: now,
    updatedAt: now,
  })
}

/**
 * Spend the session's passkey challenge: deleted in the same statement that reads it, so a
 * replay finds nothing. Returns null when missing, expired, or answered for another rpID.
 */
async function takeChallenge(
  db: Db,
  sessionId: string,
  expect: { rpId: string; now: Date },
): Promise<string | null> {
  const [row] = await db
    .delete(authSchema.verification)
    .where(eq(authSchema.verification.identifier, challengeKey(sessionId)))
    .returning({
      value: authSchema.verification.value,
      expiresAt: authSchema.verification.expiresAt,
    })
  if (!row) return null
  if (row.expiresAt.getTime() <= expect.now.getTime()) return null
  let parsed: { challenge?: unknown; rpId?: unknown }
  try {
    parsed = JSON.parse(row.value)
  } catch {
    return null
  }
  if (typeof parsed.challenge !== 'string' || parsed.rpId !== expect.rpId) return null
  return parsed.challenge
}

/**
 * Options for a passkey step-up: user verification is required (the authenticator must check the
 * person, not only that a key is present), and only this member's own credentials are offered.
 * The challenge is kept server-side, keyed to the session.
 */
export async function stepUpPasskeyOptions(
  db: Db,
  input: { sessionId: string; userId: string; rpId: string },
  now: Date = new Date(),
): Promise<{ options: PublicKeyCredentialRequestOptionsJSON }> {
  const creds = await db
    .select({
      credentialID: authSchema.passkey.credentialID,
      transports: authSchema.passkey.transports,
    })
    .from(authSchema.passkey)
    .where(eq(authSchema.passkey.userId, input.userId))
  const options = await generateAuthenticationOptions({
    rpID: input.rpId,
    userVerification: 'required',
    allowCredentials: creds.map((c) => {
      const transports = splitTransports(c.transports)
      return transports ? { id: c.credentialID, transports } : { id: c.credentialID }
    }),
  })
  await storeChallenge(db, input.sessionId, input.rpId, options.challenge, now)
  return { options }
}

/** Check a passkey step-up answer against the member's own credential and stamp the session. */
export async function verifyStepUpPasskey(
  db: Db,
  input: { sessionId: string; userId: string; rpId: string; origin: string; response: unknown },
  now: Date = new Date(),
): Promise<{ ok: true } | { ok: false; reason: 'invalid' }> {
  const challenge = await takeChallenge(db, input.sessionId, { rpId: input.rpId, now })
  const response = input.response as AuthenticationResponseJSON | null
  if (!challenge || !response || typeof response.id !== 'string') {
    return { ok: false, reason: 'invalid' }
  }
  const [row] = await db
    .select({
      publicKey: authSchema.passkey.publicKey,
      counter: authSchema.passkey.counter,
      transports: authSchema.passkey.transports,
    })
    .from(authSchema.passkey)
    .where(
      and(
        eq(authSchema.passkey.credentialID, response.id),
        eq(authSchema.passkey.userId, input.userId),
      ),
    )
  if (!row) return { ok: false, reason: 'invalid' }
  const transports = splitTransports(row.transports)
  let result: Awaited<ReturnType<typeof verifyAuthenticationResponse>>
  try {
    result = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: input.origin,
      expectedRPID: input.rpId,
      credential: {
        id: response.id,
        // Better Auth stores the key as standard base64 (`base64.encode`); decode it the same way.
        publicKey: new Uint8Array(Buffer.from(row.publicKey, 'base64')),
        counter: row.counter,
        ...(transports ? { transports } : {}),
      },
      requireUserVerification: true,
    })
  } catch {
    return { ok: false, reason: 'invalid' }
  }
  if (!result.verified) return { ok: false, reason: 'invalid' }
  await db
    .update(authSchema.passkey)
    .set({ counter: result.authenticationInfo.newCounter })
    .where(
      and(
        eq(authSchema.passkey.credentialID, response.id),
        eq(authSchema.passkey.userId, input.userId),
      ),
    )
  await markReauthenticated(db, { sessionId: input.sessionId, userId: input.userId }, now)
  return { ok: true }
}

/** How long ago this session last stepped up, in ms; null when the session is gone. */
export async function stepUpAgeMs(
  db: Db,
  sessionId: string,
  now: Date = new Date(),
): Promise<number | null> {
  const [row] = await db
    .select({ at: authSchema.session.reauthenticatedAt })
    .from(authSchema.session)
    .where(eq(authSchema.session.id, sessionId))
  if (!row) return null
  return now.getTime() - row.at.getTime()
}

/** Whether a `stepUpAgeMs` reading is still inside the freshness window. */
export function isFresh(ageMs: number | null): boolean {
  return ageMs !== null && ageMs >= 0 && ageMs <= STEP_UP_WINDOW_MS
}
