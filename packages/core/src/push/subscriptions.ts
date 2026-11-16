/** SOURCE OF TRUTH: member push subscriptions — WHAT: saves, removes and reads a team member's browser push subscriptions (one per browser or phone, per store), with the subscription keys encrypted at rest / WHY: Account → Notifications turns push on for "this device", and the worker needs each member's devices to send to; a device the push service says is gone is dropped */
import { memberPushSubscription, type StoreTx } from '@commerce/db'
import { and, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { decryptSecret, encryptSecret } from '../secrets'

/** What the browser's `PushSubscription.toJSON()` hands the admin, plus its user agent. */
export const PushSubscriptionInputSchema = z.object({
  endpoint: z
    .string()
    .url()
    .max(2000)
    .refine((u) => u.startsWith('https://'), 'A push endpoint is always https'),
  keys: z.object({
    p256dh: z.string().min(1).max(200),
    auth: z.string().min(1).max(100),
  }),
  userAgent: z.string().max(400).optional(),
})

export type PushSubscriptionInput = z.infer<typeof PushSubscriptionInputSchema>

/** One device to push to, keys decrypted, as `web-push` takes it. */
export type PushDevice = {
  id: string
  userId: string
  endpoint: string
  keys: { p256dh: string; auth: string }
}

/**
 * Saves this browser for the member. The same endpoint again (a page reload, a new key pair
 * after the browser rotated it) updates the row; an endpoint another member of the store had on
 * this browser moves to this member, since only the last person signed in should get the alerts.
 */
export async function savePushSubscription(
  tx: StoreTx,
  storeId: string,
  userId: string,
  input: PushSubscriptionInput,
  secret: string,
): Promise<{ id: string }> {
  const values = {
    storeId,
    userId,
    endpoint: input.endpoint,
    p256dh: encryptSecret(input.keys.p256dh, secret),
    auth: encryptSecret(input.keys.auth, secret),
    userAgent: input.userAgent ?? null,
  }
  const [row] = await tx
    .insert(memberPushSubscription)
    .values(values)
    .onConflictDoUpdate({
      target: [memberPushSubscription.storeId, memberPushSubscription.endpoint],
      set: {
        userId: values.userId,
        p256dh: values.p256dh,
        auth: values.auth,
        userAgent: values.userAgent,
      },
    })
    .returning({ id: memberPushSubscription.id })
  if (!row) throw new Error('push subscription not saved')
  return row
}

/** Turns push off for one browser of this member. True when there was one. */
export async function removePushSubscription(
  tx: StoreTx,
  userId: string,
  endpoint: string,
): Promise<boolean> {
  const gone = await tx
    .delete(memberPushSubscription)
    .where(
      and(eq(memberPushSubscription.userId, userId), eq(memberPushSubscription.endpoint, endpoint)),
    )
    .returning({ id: memberPushSubscription.id })
  return gone.length > 0
}

/** How many devices the member has push on for in this store. */
export async function pushDeviceCount(tx: StoreTx, userId: string): Promise<number> {
  const rows = await tx
    .select({ id: memberPushSubscription.id })
    .from(memberPushSubscription)
    .where(eq(memberPushSubscription.userId, userId))
  return rows.length
}

/** Every device of these members; a row whose keys no longer decrypt is skipped. */
export async function pushDevicesOf(
  tx: StoreTx,
  userIds: string[],
  secret: string,
): Promise<PushDevice[]> {
  if (userIds.length === 0) return []
  const rows = await tx
    .select()
    .from(memberPushSubscription)
    .where(inArray(memberPushSubscription.userId, userIds))
  const out: PushDevice[] = []
  for (const r of rows) {
    try {
      out.push({
        id: r.id,
        userId: r.userId,
        endpoint: r.endpoint,
        keys: { p256dh: decryptSecret(r.p256dh, secret), auth: decryptSecret(r.auth, secret) },
      })
    } catch {
      // Encrypted under a key that is gone: the member turns push on again on that device.
    }
  }
  return out
}

/** Records a delivered push, or drops a device the push service says no longer exists. */
export async function markPushDevice(
  tx: StoreTx,
  id: string,
  outcome: 'ok' | 'gone',
  now: Date = new Date(),
): Promise<void> {
  if (outcome === 'gone') {
    await tx.delete(memberPushSubscription).where(eq(memberPushSubscription.id, id))
    return
  }
  await tx
    .update(memberPushSubscription)
    .set({ lastOkAt: now })
    .where(eq(memberPushSubscription.id, id))
}
