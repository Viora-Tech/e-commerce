import { media } from '@commerce/db'
import type { AppHookContext } from '@commerce/plugins'
import { and, eq, isNotNull, ne, sql } from 'drizzle-orm'
import { z } from 'zod'
import {
  decryptStorageSettings,
  loadStoreStorageSettings,
  type StorageMigration,
  updateStorageMigration,
} from './settings'

export const MigrateStorageJobSchema = z.object({ targetProviderId: z.string().min(1) })
export type MigrateStorageJobData = z.infer<typeof MigrateStorageJobSchema>

/** Rows in a batch small enough that one slow object store call cannot stall the job for long. */
const BATCH_SIZE = 25

const pendingWhere = (targetProviderId: string) =>
  and(
    eq(media.status, 'ready'),
    isNotNull(media.key),
    isNotNull(media.provider),
    ne(media.provider, targetProviderId),
  )

async function patchMigrationState(
  ctx: AppHookContext,
  patch: Partial<StorageMigration> & { targetProviderId: string },
): Promise<void> {
  await ctx.inStore(async (tx) => {
    const current = await loadStoreStorageSettings(tx, ctx.storeId)
    const now = new Date().toISOString()
    const next: StorageMigration = {
      targetProviderId: patch.targetProviderId,
      status: patch.status ?? current.migration?.status ?? 'running',
      total: patch.total ?? current.migration?.total ?? 0,
      done: patch.done ?? current.migration?.done ?? 0,
      failed: patch.failed ?? current.migration?.failed ?? 0,
      startedAt: patch.startedAt ?? current.migration?.startedAt ?? now,
      updatedAt: now,
      ...(patch.error !== undefined ? { error: patch.error } : {}),
    }
    await updateStorageMigration(tx, ctx.storeId, next)
  })
}

/**
 * "Move existing files to <connection>": copies every media row not already
 * on `targetProviderId` from the provider its row says it is on today, to the
 * target. Idempotent and resumable — the query for work left is always
 * `provider != target`, so re-running (retried by BullMQ, or clicked again
 * after a restart) only ever touches rows that have not moved yet, in any
 * order. A source object is deleted only once the bytes have been written to
 * the target *and* read back the same size, so a crash mid-copy never loses
 * the original.
 */
export async function migrateStorage(ctx: AppHookContext, raw: unknown): Promise<void> {
  const { targetProviderId } = MigrateStorageJobSchema.parse(raw)
  // Loaded lazily: `getRegistries` pulls in every plugin package listed in commerce.config.ts
  // (R2, Razorpay, ...). core-plugin.ts (which this job lives on) must stay light, since it is
  // part of every `@commerce/core` import — eagerly importing it here would pull every adapter's
  // runtime, and its SDK, into code that only ever wanted `localStoragePath` or similar.
  const { getRegistries } = await import('../plugins/registries')
  const registries = getRegistries()
  const settings = await ctx.inStore((tx) => loadStoreStorageSettings(tx, ctx.storeId))
  const decrypted = decryptStorageSettings(settings, ctx.settingsSecret)

  const built = registries.storage.create(
    targetProviderId,
    decrypted.providers[targetProviderId] ?? {},
  )
  if (!built.ok) {
    throw new Error(
      `cannot build target storage provider "${targetProviderId}": ${built.errors.join(', ')}`,
    )
  }
  const target = built.provider

  const [{ n: total } = { n: 0 }] = await ctx.inStore((tx) =>
    tx.select({ n: sql<number>`count(*)::int` }).from(media).where(pendingWhere(targetProviderId)),
  )

  await patchMigrationState(ctx, {
    targetProviderId,
    status: 'running',
    total,
    done: 0,
    failed: 0,
    startedAt: new Date().toISOString(),
    error: undefined,
  })

  let done = 0
  let failed = 0
  for (;;) {
    const batch = await ctx.inStore((tx) =>
      tx.select().from(media).where(pendingWhere(targetProviderId)).limit(BATCH_SIZE),
    )
    if (batch.length === 0) break

    for (const row of batch) {
      try {
        if (!row.key || !row.provider) continue
        const srcBuilt = registries.storage.create(
          row.provider,
          decrypted.providers[row.provider] ?? {},
        )
        const bytes = srcBuilt.ok ? await srcBuilt.provider.get(row.key) : null
        if (!bytes) {
          failed++
          ctx.log(`migrate ${row.id}: source object missing on "${row.provider}"`)
          continue
        }
        await target.put({
          key: row.key,
          body: bytes,
          contentType: row.contentType ?? 'application/octet-stream',
        })
        // Verify before anything else changes: the copy must read back the same size.
        const verify = await target.get(row.key)
        if (!verify || verify.byteLength !== bytes.byteLength) {
          failed++
          ctx.log(`migrate ${row.id}: copy to "${targetProviderId}" failed verification`)
          continue
        }
        await ctx.inStore((tx) =>
          tx
            .update(media)
            .set({ provider: targetProviderId, url: target.publicUrl(row.key as string) })
            .where(eq(media.id, row.id)),
        )
        // Only delete the source once the target copy is verified and the row points at it.
        if (srcBuilt.ok) await srcBuilt.provider.delete(row.key)
        done++
      } catch (err) {
        failed++
        ctx.log(`migrate ${row.id}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
    await patchMigrationState(ctx, { targetProviderId, done, failed })
  }

  await patchMigrationState(ctx, {
    targetProviderId,
    status: failed > 0 && done === 0 && total > 0 ? 'failed' : 'done',
    done,
    failed,
  })
}
