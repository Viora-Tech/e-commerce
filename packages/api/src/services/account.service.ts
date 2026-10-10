import { randomUUID } from 'node:crypto'
import {
  avatarKey,
  CommerceError,
  type DeviceDescription,
  describeUserAgent,
  isOwnAvatarKey,
  memberAccess,
  processAvatar,
} from '@commerce/core'
import {
  authSchema,
  type Db,
  resolveStoreForOrganization,
  type StoreTx,
  storeMember,
  withStore,
} from '@commerce/db'
import type { StorageProvider } from '@commerce/storage'
import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { storeRegistries } from './apps.service'
import { storageProviderFor } from './media.service'

/** What Account → Profile shows: the signed-in member's own row, nothing about the store. */
export type MemberProfile = {
  id: string
  name: string
  email: string
  image: string | null
  phone: string | null
}

export async function memberProfile(db: Db, userId: string): Promise<MemberProfile | null> {
  const [row] = await db
    .select({
      id: authSchema.user.id,
      name: authSchema.user.name,
      email: authSchema.user.email,
      image: authSchema.user.image,
      phone: authSchema.user.phone,
    })
    .from(authSchema.user)
    .where(eq(authSchema.user.id, userId))
  return row ?? null
}

/** Name and phone, already checked by `MemberProfileInputSchema`. Only ever the caller's own row. */
export async function updateMemberProfile(
  db: Db,
  userId: string,
  input: { name: string; phone: string | null },
): Promise<MemberProfile | null> {
  await db
    .update(authSchema.user)
    .set({ name: input.name, phone: input.phone, updatedAt: new Date() })
    .where(eq(authSchema.user.id, userId))
  return memberProfile(db, userId)
}

/** `stores/<storeId>/avatars/<userId>/<id>.webp` inside a stored public URL, if there is one. */
function avatarKeyIn(url: string | null): string | null {
  if (!url) return null
  return /stores\/[^/?#]+\/avatars\/[^/?#]+\/[^/?#]+\.webp/.exec(url)?.[0] ?? null
}

/** The active store's storage (the one media uploads use), resolved in one short transaction. */
function avatarStorage(db: Db, storeId: string, secret: string): Promise<StorageProvider> {
  return withStore(db, storeId, async (tx: StoreTx) => {
    const { storage } = await storeRegistries(tx, storeId)
    return storageProviderFor(tx, storeId, storage, secret)
  })
}

/**
 * Re-encodes the cropped photo, stores it under the active store's folder and points the
 * member's `image` at it. The previous photo is deleted when it lives in this same store;
 * one left behind in another store goes when that store is closed.
 */
export async function setMemberAvatar(
  db: Db,
  input: { userId: string; storeId: string; bytes: Uint8Array; secret: string },
): Promise<MemberProfile | null> {
  const body = await processAvatar(input.bytes)
  const storage = await avatarStorage(db, input.storeId, input.secret)
  const key = avatarKey(input.storeId, input.userId, randomUUID())
  await storage.put({ key, body, contentType: 'image/webp' })

  const before = await memberProfile(db, input.userId)
  await db
    .update(authSchema.user)
    .set({ image: storage.publicUrl(key), updatedAt: new Date() })
    .where(eq(authSchema.user.id, input.userId))
  await deleteOwnAvatar(storage, before?.image ?? null, input.storeId, input.userId)
  return memberProfile(db, input.userId)
}

/** Back to initials. The stored photo is deleted when it lives in the active store. */
export async function removeMemberAvatar(
  db: Db,
  input: { userId: string; storeId: string; secret: string },
): Promise<MemberProfile | null> {
  const before = await memberProfile(db, input.userId)
  await db
    .update(authSchema.user)
    .set({ image: null, updatedAt: new Date() })
    .where(eq(authSchema.user.id, input.userId))
  if (avatarKeyIn(before?.image ?? null)) {
    const storage = await avatarStorage(db, input.storeId, input.secret)
    await deleteOwnAvatar(storage, before?.image ?? null, input.storeId, input.userId)
  }
  return memberProfile(db, input.userId)
}

async function deleteOwnAvatar(
  storage: Pick<StorageProvider, 'delete'>,
  url: string | null,
  storeId: string,
  userId: string,
) {
  const key = avatarKeyIn(url)
  if (!key || !isOwnAvatarKey(key, storeId, userId)) return
  // A photo that cannot be deleted only costs a few KB; never fail the change over it.
  await storage.delete(key).catch(() => undefined)
}

/** One row of Account → Stores. */
export type MemberStore = {
  organizationId: string
  name: string
  slug: string
  logo: string | null
  /** The store role ("Owner", "Staff"); null until the member first opens the store. */
  roleName: string | null
  isOwner: boolean
  /** The store this browser is working in now. */
  active: boolean
  joinedAt: Date
}

type Membership = { organizationId: string; role: string }

/** Better Auth's membership row for this member and organization, if they belong to it. */
async function membershipOf(
  db: Db,
  userId: string,
  organizationId: string,
): Promise<Membership | null> {
  const [row] = await db
    .select({ organizationId: authSchema.member.organizationId, role: authSchema.member.role })
    .from(authSchema.member)
    .where(
      and(
        eq(authSchema.member.userId, userId),
        eq(authSchema.member.organizationId, organizationId),
      ),
    )
  return row ?? null
}

/** The member's store role, read inside that store's own RLS scope; null when not set up yet. */
async function storeAccess(db: Db, organizationId: string, userId: string) {
  const storeId = await resolveStoreForOrganization(db, organizationId)
  if (!storeId) return { storeId: null, access: null }
  const access = await withStore(db, storeId, (tx: StoreTx) => memberAccess(tx, storeId, userId))
  return { storeId, access }
}

/** Owner by the store role, or by Better Auth's organization role before roles were healed. */
function ownsStore(membership: Membership, access: { isOwner: boolean } | null): boolean {
  return access ? access.isOwner : membership.role.split(',').includes('owner')
}

/** Every store this member belongs to, by name, with their role in each. */
export async function memberStores(
  db: Db,
  userId: string,
  activeOrganizationId: string | null,
): Promise<MemberStore[]> {
  const rows = await db
    .select({
      organizationId: authSchema.organization.id,
      name: authSchema.organization.name,
      slug: authSchema.organization.slug,
      logo: authSchema.organization.logo,
      role: authSchema.member.role,
      joinedAt: authSchema.member.createdAt,
    })
    .from(authSchema.member)
    .innerJoin(
      authSchema.organization,
      eq(authSchema.organization.id, authSchema.member.organizationId),
    )
    .where(eq(authSchema.member.userId, userId))
    .orderBy(asc(authSchema.organization.name))

  return Promise.all(
    rows.map(async (row) => {
      const { access } = await storeAccess(db, row.organizationId, userId)
      const isOwner = ownsStore(row, access)
      return {
        organizationId: row.organizationId,
        name: row.name,
        slug: row.slug,
        logo: row.logo,
        roleName: access?.roleName ?? null,
        isOwner,
        active: row.organizationId === activeOrganizationId,
        joinedAt: row.joinedAt,
      }
    }),
  )
}

export class LeaveStoreRefused extends CommerceError {
  constructor(readonly reason: 'not_member' | 'owner') {
    super(
      'LEAVE_STORE_REFUSED',
      reason === 'owner'
        ? 'You own this store, so you cannot leave it. Hand it over to someone else first.'
        : 'You are not a member of this store.',
    )
  }
}

/**
 * Checks the member may leave: they belong to the store and do not own it (a store always
 * keeps its owner). Returns the store id whose staff row goes once Better Auth lets them go.
 */
export async function assertCanLeaveStore(
  db: Db,
  userId: string,
  organizationId: string,
): Promise<{ storeId: string | null }> {
  const membership = await membershipOf(db, userId, organizationId)
  if (!membership) throw new LeaveStoreRefused('not_member')
  const { storeId, access } = await storeAccess(db, organizationId, userId)
  if (ownsStore(membership, access)) throw new LeaveStoreRefused('owner')
  return { storeId }
}

/** Drops the member's staff row (role, accent) in the store they just left. */
export async function forgetStoreMembership(db: Db, storeId: string, userId: string) {
  await withStore(db, storeId, (tx: StoreTx) =>
    tx
      .delete(storeMember)
      .where(and(eq(storeMember.storeId, storeId), eq(storeMember.userId, userId))),
  )
}

/** One row of Account → Sign-in & security → Recent sign-ins. */
export type RecentSignIn = {
  id: string
  method: string
  device: DeviceDescription
  ipMasked: string | null
  city: string | null
  country: string | null
  at: Date
  /** The sign-in that opened the session this browser is using. */
  current: boolean
}

/** The member's latest sign-ins, newest first; only ever their own. */
export async function recentSignIns(
  db: Db,
  userId: string,
  currentSessionId: string | null,
  limit = 10,
): Promise<RecentSignIn[]> {
  const rows = await db
    .select()
    .from(authSchema.memberSignIn)
    .where(eq(authSchema.memberSignIn.userId, userId))
    .orderBy(desc(authSchema.memberSignIn.createdAt))
    .limit(limit)
  return rows.map((r) => ({
    id: r.id,
    method: r.method,
    device: describeUserAgent(r.userAgent),
    ipMasked: r.ipMasked,
    city: r.city,
    country: r.country,
    at: r.createdAt,
    current: r.sessionId !== null && r.sessionId === currentSessionId,
  }))
}

/** A signed-in device as Account → Sessions shows it. Never carries the session token. */
export type MemberSession = {
  id: string
  device: DeviceDescription
  ipMasked: string | null
  city: string | null
  country: string | null
  signedInAt: Date
  lastActiveAt: Date
  current: boolean
}

type AuthSession = {
  id: string
  userAgent?: string | null | undefined
  createdAt: Date
  updatedAt: Date
}

/** Better Auth's sessions for the member, with where each began, newest activity first. */
export async function describeSessions(
  db: Db,
  userId: string,
  sessions: readonly AuthSession[],
  currentSessionId: string | null,
): Promise<MemberSession[]> {
  const ids = sessions.map((s) => s.id)
  const starts = ids.length
    ? await db
        .select({
          sessionId: authSchema.memberSignIn.sessionId,
          ipMasked: authSchema.memberSignIn.ipMasked,
          city: authSchema.memberSignIn.city,
          country: authSchema.memberSignIn.country,
        })
        .from(authSchema.memberSignIn)
        .where(
          and(
            eq(authSchema.memberSignIn.userId, userId),
            inArray(authSchema.memberSignIn.sessionId, ids),
          ),
        )
    : []
  const bySession = new Map(starts.map((s) => [s.sessionId, s]))
  return sessions
    .map((s) => {
      const start = bySession.get(s.id)
      return {
        id: s.id,
        device: describeUserAgent(s.userAgent),
        ipMasked: start?.ipMasked ?? null,
        city: start?.city ?? null,
        country: start?.country ?? null,
        signedInAt: s.createdAt,
        lastActiveAt: s.updatedAt,
        current: s.id === currentSessionId,
      }
    })
    .sort((a, b) =>
      a.current === b.current
        ? b.lastActiveAt.getTime() - a.lastActiveAt.getTime()
        : a.current
          ? -1
          : 1,
    )
}

/** The token of one of the member's own sessions, so Better Auth can revoke it; null if not theirs. */
export async function sessionTokenFor(
  db: Db,
  userId: string,
  sessionId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ token: authSchema.session.token })
    .from(authSchema.session)
    .where(and(eq(authSchema.session.id, sessionId), eq(authSchema.session.userId, userId)))
  return row?.token ?? null
}
