import { permissions } from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import {
  BACK_IN_STOCK_ID,
  BackInStockStoreSettingsSchema,
  listSignups,
  loadPlatformQuota,
  loadStoreSettings,
  maskContact,
  SIGNUP_STATUSES,
  saveStoreSettings,
  importRestockTags,
  topVariantsByWaiting,
  usageOverview,
} from '@commerce/plugin-back-in-stock/server'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { can } from '../procedures'
import { getStoreApps } from '../services/apps.service'
import { variantLabel } from '../services/back-in-stock.service'

type Ctx = { tx: StoreTx; scope: { storeId: string } }

async function requireInstalled(context: Ctx) {
  const apps = await getStoreApps(context.tx, context.scope.storeId)
  if (!apps.installed.includes(BACK_IN_STOCK_ID)) {
    throw new ORPCError('PRECONDITION_FAILED', { message: 'Install the Back in stock app first' })
  }
}

export const backInStockRouter = {
  overview: can(permissions.SETTINGS_READ).handler(async ({ context }) => {
    await requireInstalled(context)
    const settings = await loadStoreSettings(context.tx, context.scope.storeId)
    const usage = await usageOverview(
      context.tx,
      context.scope.storeId,
      loadPlatformQuota(),
      settings.unlimited,
    )
    const top = await topVariantsByWaiting(context.tx, context.scope.storeId, 10)
    const withLabels = await Promise.all(
      top.map(async (t) => ({ ...t, label: await variantLabel(context.tx, t.variantId) })),
    )
    return { usage, topVariants: withLabels }
  }),
  signups: {
    list: can(permissions.SETTINGS_READ)
      .input(
        z.object({ variantId: z.uuid().optional(), status: z.enum(SIGNUP_STATUSES).optional() }),
      )
      .handler(async ({ context, input }) => {
        await requireInstalled(context)
        const rows = await listSignups(context.tx, context.scope.storeId, input)
        return Promise.all(
          rows.map(async (r) => ({
            id: r.id,
            variantId: r.variantId,
            variantLabel: await variantLabel(context.tx, r.variantId),
            contact: maskContact(r.email, r.phone),
            status: r.status,
            createdAt: r.createdAt,
            confirmedAt: r.confirmedAt,
            notifiedAt: r.notifiedAt,
            unsubscribedAt: r.unsubscribedAt,
          })),
        )
      }),
    /** "Bring over restock tags": Shopify restock-app customer tags become waiting signups. */
    importRestockTags: can(permissions.SETTINGS_MANAGE).handler(async ({ context }) => {
      await requireInstalled(context)
      return importRestockTags(context.tx, context.scope.storeId)
    }),
  },
  settings: {
    get: can(permissions.SETTINGS_READ).handler(async ({ context }) => {
      await requireInstalled(context)
      return loadStoreSettings(context.tx, context.scope.storeId)
    }),
    save: can(permissions.SETTINGS_MANAGE)
      .input(BackInStockStoreSettingsSchema.omit({ unlimited: true }).partial())
      .handler(async ({ context, input }) => {
        await requireInstalled(context)
        // `unlimited` is a platform override (seed/config), never set from this form.
        return saveStoreSettings(context.tx, context.scope.storeId, input)
      }),
  },
}
