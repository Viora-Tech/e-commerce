/** SOURCE OF TRUTH: storage room — WHAT compares a store's stored files with its plan's GB / WHY the owner's limits of 2026-10-28 (5 / 10 / 50 / 100 GB) are enforced on new uploads, never on files already stored */
import { media, type StoreTx } from '@commerce/db'
import { eq, sql } from 'drizzle-orm'
import type { StorageSettings } from '../media/settings'
import { PLANS, type PlanId } from './plans'
import { ensureStorePlan } from './service'

/** `limitBytes` null: an unlimited store (Koomerce's own). */
export type StorageRoom = { plan: PlanId; usedBytes: number; limitBytes: number | null }

const GB = 1024 ** 3

/** The bytes this store keeps (every media row, as Plan & billing shows) against its plan. */
export async function storageRoom(tx: StoreTx, storeId: string): Promise<StorageRoom> {
  const plan = await ensureStorePlan(tx, storeId)
  const [row] = await tx
    .select({ bytes: sql<number>`coalesce(sum(${media.size}), 0)::bigint` })
    .from(media)
    .where(eq(media.storeId, storeId))
  return {
    plan: plan.plan,
    usedBytes: Number(row?.bytes ?? 0),
    limitBytes: plan.unlimited ? null : PLANS[plan.plan].storageGb * GB,
  }
}

/**
 * Whether uploads land in the platform's own bucket (the deployment's R2_* / S3_* defaults, or
 * the local folder), which the plan's GB pays for. A bucket the merchant connected is theirs to
 * pay for, so it has no plan limit.
 */
export function onPlatformStorage(
  settings: StorageSettings,
  env: Record<string, string | undefined>,
): boolean {
  const id = settings.enabled[0]
  if (!id) return true
  const bucket = settings.providers[id]?.bucket
  return !bucket || bucket === env.R2_BUCKET || bucket === env.S3_BUCKET
}
