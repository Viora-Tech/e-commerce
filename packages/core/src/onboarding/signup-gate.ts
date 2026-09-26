import { type Db, newId, signupInvite } from '@commerce/db'
import { and, eq, isNull } from 'drizzle-orm'
import { CommerceError } from '../errors'

export type MerchantSignupMode = 'invite' | 'open'

export type SignupInviteRecord = {
  id: string
  email: string
  token: string
  expiresAt: Date
  usedAt: Date | null
  createdAt: Date
}

const norm = (email: string): string => email.trim().toLowerCase()

/** Cancels a still-live invite for the email, if any, before issuing a fresh one. */
async function cancelLiveInvite(db: Db, email: string): Promise<void> {
  await db
    .update(signupInvite)
    .set({ usedAt: new Date() })
    .where(and(eq(signupInvite.email, norm(email)), isNull(signupInvite.usedAt)))
}

/**
 * Issues a single-use invite for `email` to sign up and create their own
 * store. Used by `bun run platform:invite <email>` - there is no platform
 * admin UI yet.
 */
export async function createSignupInvite(
  db: Db,
  email: string,
  opts: { expiresInMs?: number } = {},
): Promise<SignupInviteRecord> {
  await cancelLiveInvite(db, email)
  const expiresInMs = opts.expiresInMs ?? 14 * 24 * 60 * 60 * 1000
  const [row] = await db
    .insert(signupInvite)
    .values({
      id: newId(),
      email: norm(email),
      token: newId(),
      expiresAt: new Date(Date.now() + expiresInMs),
    })
    .returning()
  if (!row) throw new Error('signup invite insert failed')
  return row
}

/** A live (unused, unexpired) invite for this email, if there is one. */
export async function findLiveSignupInvite(
  db: Db,
  email: string,
): Promise<SignupInviteRecord | null> {
  const rows = await db
    .select()
    .from(signupInvite)
    .where(and(eq(signupInvite.email, norm(email)), isNull(signupInvite.usedAt)))
  const row = rows[0]
  if (!row) return null
  if (row.expiresAt.getTime() <= Date.now()) return null
  return row
}

/** Marks the invite consumed. Call once the store it unlocked actually exists. */
export async function consumeSignupInvite(db: Db, id: string): Promise<void> {
  await db.update(signupInvite).set({ usedAt: new Date() }).where(eq(signupInvite.id, id))
}

export type SignupGateErrorCode = 'SIGNUP_NOT_ALLOWED'

export class SignupGateError extends CommerceError {
  declare readonly code: SignupGateErrorCode
  constructor(message: string) {
    super('SIGNUP_NOT_ALLOWED', message)
  }
}

export type SignupGateDecision =
  | { allowed: true; invite: SignupInviteRecord | null }
  | { allowed: false }

/**
 * Whether `email` may create their first store right now.
 *
 * Only gates the *first* store: a merchant who already owns one is free to
 * create another (up to Better Auth's `organizationLimit`), same as clicking
 * "Create another store" from the picker. Existing staff invitations to join
 * an existing store (Better Auth `invitation`, `apps/admin/.../accept-invitation`)
 * are a separate flow and are never affected by this gate.
 */
export async function checkSignupGate(
  db: Db,
  input: { email: string; mode: MerchantSignupMode; ownsAStoreAlready: boolean },
): Promise<SignupGateDecision> {
  if (input.ownsAStoreAlready) return { allowed: true, invite: null }
  if (input.mode === 'open') return { allowed: true, invite: null }
  const invite = await findLiveSignupInvite(db, input.email)
  return invite ? { allowed: true, invite } : { allowed: false }
}
