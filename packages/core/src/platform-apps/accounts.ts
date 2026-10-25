/** SOURCE OF TRUTH: platform accounts — WHAT: which outside account (Facebook user, WhatsApp Business account, Shopify shop) belongs to a store, and what the platform last said about it / WHY: platform callbacks name an account, never a store */
/**
 * A store's account on an outside platform, one per platform (`platform_account`):
 *
 * - `meta`: the Facebook user who connected Sales channels (Meta's deauthorize and data
 *   deletion callbacks name only that user).
 * - `whatsapp`: the WhatsApp Business account from Embedded Signup (its webhooks name the
 *   account).
 * - `shopify`: the shop the Koomerce migration app is installed on (`app/uninstalled`).
 *
 * Linking is in-store (RLS); finding the stores behind an id is the security-definer
 * `stores_for_platform_account()` (`storesForPlatformAccount` in `@commerce/db`).
 */
import { type Db, type PlatformAccountKind, platformAccount, withStore } from '@commerce/db'
import { and, eq } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { insertOutboxEvent } from '../outbox/write'

export type PlatformAccountRow = typeof platformAccount.$inferSelect

export async function linkPlatformAccount(
  ctx: StoreContext,
  platform: PlatformAccountKind,
  externalId: string,
  detail: Record<string, string> = {},
  now = new Date(),
): Promise<void> {
  const values = { externalId, status: 'active', detail, updatedAt: now }
  await ctx.tx
    .insert(platformAccount)
    .values({ storeId: ctx.storeId, platform, ...values, createdAt: now })
    .onConflictDoUpdate({
      target: [platformAccount.storeId, platformAccount.platform],
      set: values,
    })
}

export async function unlinkPlatformAccount(
  ctx: StoreContext,
  platform: PlatformAccountKind,
): Promise<void> {
  await ctx.tx
    .delete(platformAccount)
    .where(and(eq(platformAccount.storeId, ctx.storeId), eq(platformAccount.platform, platform)))
}

export async function loadPlatformAccount(
  ctx: StoreContext,
  platform: PlatformAccountKind,
): Promise<PlatformAccountRow | null> {
  const [row] = await ctx.tx
    .select()
    .from(platformAccount)
    .where(and(eq(platformAccount.storeId, ctx.storeId), eq(platformAccount.platform, platform)))
  return row ?? null
}

/**
 * What a platform's webhook said about an account (a restricted WhatsApp account, a phone
 * number's new quality rating), on every store linked to it. Detail keys merge; a status of
 * `null` keeps the current one.
 */
export async function recordPlatformEvent(
  db: Db,
  storeId: string,
  platform: PlatformAccountKind,
  externalId: string,
  update: { status?: string | null | undefined; detail?: Record<string, string> },
  now = new Date(),
): Promise<boolean> {
  return withStore(db, storeId, async (tx) => {
    const [row] = await tx
      .select()
      .from(platformAccount)
      .where(
        and(
          eq(platformAccount.storeId, storeId),
          eq(platformAccount.platform, platform),
          eq(platformAccount.externalId, externalId),
        ),
      )
    if (!row) return false
    await tx
      .update(platformAccount)
      .set({
        status: update.status ?? row.status,
        detail: { ...row.detail, ...(update.detail ?? {}) },
        lastEventAt: now,
        updatedAt: now,
      })
      .where(eq(platformAccount.id, row.id))
    if (platform === 'whatsapp')
      await insertOutboxEvent(tx, storeId, 'whatsapp.account_updated', {
        platform,
        externalId,
        platformStatus: update.status ?? row.status,
        message: Object.entries(update.detail ?? {})
          .map(([k, v]) => `${k}: ${v}`)
          .join('; ')
          .slice(0, 300),
      })
    return true
  })
}
