import { permissions } from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import {
  analyticsSummary,
  BACK_IN_STOCK_ID,
  BackInStockStoreSettingsSchema,
  demandByVariant,
  importRestockTags,
  listSignups,
  loadPlatformQuota,
  loadStoreSettings,
  maskContact,
  SIGNUP_STATUSES,
  saveStoreSettings,
  usageOverview,
} from '@commerce/plugin-back-in-stock/server'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { can } from '../procedures'
import { getStoreApps } from '../services/apps.service'
import { variantLabel, variantLabels } from '../services/back-in-stock.service'

type Ctx = { tx: StoreTx; scope: { storeId: string } }

async function requireInstalled(context: Ctx) {
  const apps = await getStoreApps(context.tx, context.scope.storeId)
  if (!apps.installed.includes(BACK_IN_STOCK_ID)) {
    throw new ORPCError('PRECONDITION_FAILED', { message: 'Install the Back in stock app first' })
  }
}

export const backInStockRouter = {
  /**
   * The Overview (Essential's Analytics tab): this month's sending against the free quota, the
   * four period figures with the period before, and one row per variant anyone asked about.
   */
  overview: can(permissions.SETTINGS_READ)
    .input(z.object({ from: z.coerce.date(), to: z.coerce.date() }).optional())
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      const { storeId } = context.scope
      const to = input?.to ?? new Date()
      const from = input?.from ?? new Date(to.getTime() - 30 * 86_400_000)
      const period = { from, to }
      const settings = await loadStoreSettings(context.tx, storeId)
      const usage = await usageOverview(
        context.tx,
        storeId,
        loadPlatformQuota(),
        settings.unlimited,
      )
      const summary = await analyticsSummary(context.tx, storeId, period)
      const demand = await demandByVariant(context.tx, storeId, period)
      const labels = await variantLabels(
        context.tx,
        demand.map((d) => d.variantId),
      )
      return {
        usage,
        summary,
        campaign: { enabled: settings.enabled, title: settings.title },
        variants: demand.map((d) => ({
          ...d,
          label: labels.get(d.variantId)?.label ?? d.variantId,
        })),
      }
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
    /**
     * Every signup with its full contact, for "Export signups" (CSV). Manage permission, since
     * unlike the list it carries whole email addresses and numbers.
     */
    export: can(permissions.SETTINGS_MANAGE).handler(async ({ context }) => {
      await requireInstalled(context)
      const rows = await listSignups(context.tx, context.scope.storeId)
      const labels = await variantLabels(
        context.tx,
        rows.map((r) => r.variantId),
      )
      return rows.map((r) => ({
        product: labels.get(r.variantId)?.productTitle ?? '',
        variant: labels.get(r.variantId)?.variantTitle ?? '',
        email: r.email ?? '',
        phone: r.phone ?? '',
        status: r.status,
        createdAt: r.createdAt,
        notifiedAt: r.notifiedAt,
      }))
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
