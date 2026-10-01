/** SOURCE OF TRUTH: merchant signup gate — WHAT decides whether a signed-in person may create their first store (MERCHANT_SIGNUP_MODE, single-use signup invites) / WHY invite mode keeps the platform closed while it is tested with a few merchants */
import { authSchema, type Db, newId, signupInvite, signupWaitlist } from '@commerce/db'
import { and, eq, isNull } from 'drizzle-orm'

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
 * admin UI yet. Marks the email's waitlist entry, if any, as invited.
 */
export async function createSignupInvite(
  db: Db,
  email: string,
  opts: { expiresInMs?: number; planOrderId?: string } = {},
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
      planOrderId: opts.planOrderId ?? null,
    })
    .returning()
  if (!row) throw new Error('signup invite insert failed')
  await db
    .update(signupWaitlist)
    .set({ invitedAt: row.createdAt, updatedAt: new Date() })
    .where(eq(signupWaitlist.email, row.email))
  return row
}

/** A live (unused, unexpired) invite for this email, if there is one. */
async function findLiveSignupInvite(db: Db, email: string): Promise<SignupInviteRecord | null> {
  const rows = await db
    .select()
    .from(signupInvite)
    .where(and(eq(signupInvite.email, norm(email)), isNull(signupInvite.usedAt)))
  const row = rows[0]
  if (!row) return null
  if (row.expiresAt.getTime() <= Date.now()) return null
  return row
}

/**
 * Claims the invite before the store is created: true for exactly one caller, so two
 * parallel "Create store" requests cannot both ride one single-use invite. Give it back
 * with `releaseSignupInvite` if the store could not be created.
 */
export async function consumeSignupInvite(db: Db, id: string): Promise<boolean> {
  const rows = await db
    .update(signupInvite)
    .set({ usedAt: new Date() })
    .where(and(eq(signupInvite.id, id), isNull(signupInvite.usedAt)))
    .returning({ id: signupInvite.id })
  return rows.length > 0
}

/** Undoes `consumeSignupInvite` when creating the store failed. */
export async function releaseSignupInvite(db: Db, id: string): Promise<void> {
  await db.update(signupInvite).set({ usedAt: null }).where(eq(signupInvite.id, id))
}

/** A Better Auth member role (`owner`, or several joined by commas) that owns the organisation. */
export function isOwnerRole(role: string): boolean {
  return role.split(',').some((r) => r.trim() === 'owner')
}

/**
 * Whether this user owns a store already. Staff membership does not count: anyone can be
 * invited as staff by any merchant, so counting it would let a staff invite skip the
 * invite-only gate for creating stores of your own.
 */
export async function userOwnsAStore(db: Db, userId: string): Promise<boolean> {
  const { member } = authSchema
  const rows = await db.select({ role: member.role }).from(member).where(eq(member.userId, userId))
  return rows.some((r) => isOwnerRole(r.role))
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
