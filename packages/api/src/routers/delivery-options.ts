import { settingsSecret } from '@commerce/config'
import {
  addPresetOptions,
  DELIVERY_LAYOUTS,
  type DeliveryHealth,
  DeliveryOptionInputSchema,
  deleteDeliveryOption,
  deleteRouteRule,
  deleteRouteSetting,
  deliveryExpressShare,
  deliveryHealth,
  deliveryOptionsInstalled,
  deliveryOverview,
  deliveryRouteCatalogue,
  loadDeliveryConfig,
  ProtectCardSchema,
  permissions,
  RouteRuleInputSchema,
  RouteSettingInputSchema,
  reorderDeliveryOptions,
  reorderRouteRules,
  resolveShippingProviders,
  saveDeliveryLayout,
  saveDeliveryOption,
  saveProtectCard,
  saveRouteRule,
  saveRouteSetting,
  tryDeliveryPin,
} from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { BULK_MAX, can } from '../procedures'
import { storeRegistries } from '../services/apps.service'
import { loadShippingSettings } from '../services/shipping.service'

type Ctx = { tx: StoreTx; scope: { storeId: string } }

const NO_HEALTH: DeliveryHealth = { apps: [], checkouts24h: 0, backup24h: 0, typicalMs: null }

/** One option as the Options page edits it in place: its id (null: new) and its settings. */
const OptionEditSchema = z.object({ id: z.uuid().nullable(), option: DeliveryOptionInputSchema })

/** The Options page's unsaved edits, for its live preview: nothing is written. */
const DraftSchema = z.object({
  layout: z.enum(DELIVERY_LAYOUTS).optional(),
  options: z
    .array(
      DeliveryOptionInputSchema.extend({
        id: z.string().min(1).max(64),
        position: z.number().int().min(0).max(1000),
      }),
    )
    .max(20)
    .optional(),
})

async function requireInstalled(context: Ctx) {
  if (!(await deliveryOptionsInstalled(context.tx, context.scope.storeId))) {
    throw new ORPCError('PRECONDITION_FAILED', {
      message: 'Install the Delivery options app first',
    })
  }
}

/** The store's connected courier apps, credentials decrypted server-side only. */
async function providersOf(context: Ctx) {
  const { shipping } = await storeRegistries(context.tx, context.scope.storeId)
  const settings = await loadShippingSettings(context.tx, context.scope.storeId)
  return {
    providers: resolveShippingProviders(shipping, settings, settingsSecret()).providers,
    settings,
  }
}

const failed = (err: unknown): never => {
  throw new ORPCError('BAD_REQUEST', { message: err instanceof Error ? err.message : String(err) })
}

/**
 * Apps → Delivery options. Read with `settings.read`, change with `settings.manage`, like the
 * rest of the shipping settings. Try a PIN asks the store's own couriers, so it is rate-limited
 * by being a settings action only staff can reach.
 */
export const deliveryOptionsRouter = {
  overview: can(permissions.SETTINGS_READ).handler(async ({ context }) => {
    await requireInstalled(context)
    const { providers } = await providersOf(context)
    const overview = await deliveryOverview(context.tx, context.scope.storeId, providers)
    // What checkout recorded: each app's recent calls and breaker, and the backup share.
    const health = context.deliveryHealth
      ? await deliveryHealth(
          context.deliveryHealth,
          context.scope.storeId,
          overview.apps.map((a) => a.id),
        ).catch(() => NO_HEALTH)
      : NO_HEALTH
    // Shoppers picking Express: the last 30 days of orders (one indexed statement).
    const express = await deliveryExpressShare(context.tx, overview.options)
    return { ...overview, health, express }
  }),

  /** The app bar's status pill: courier apps connected and the share priced live today. */
  status: can(permissions.SETTINGS_READ).handler(async ({ context }) => {
    await requireInstalled(context)
    const { providers } = await providersOf(context)
    const overview = await deliveryOverview(context.tx, context.scope.storeId, providers)
    const health = context.deliveryHealth
      ? await deliveryHealth(context.deliveryHealth, context.scope.storeId, []).catch(
          () => NO_HEALTH,
        )
      : NO_HEALTH
    return {
      apps: overview.apps.length,
      checkouts24h: health.checkouts24h,
      backup24h: health.backup24h,
    }
  }),

  /**
   * Routes: every courier x app x service the connected apps offer, asked on two long lanes
   * from the store's origin through checkout's answer cache (live only when nothing is cached),
   * with the route settings applied. Couriers have no "list my services" call.
   */
  routeCatalogue: can(permissions.SETTINGS_READ).handler(async ({ context }) => {
    await requireInstalled(context)
    const { providers, settings } = await providersOf(context)
    const config = await loadDeliveryConfig(context.tx, context.scope.storeId)
    return deliveryRouteCatalogue(
      context.scope.storeId,
      providers,
      settings,
      config,
      context.deliveryHealth ?? null,
    ).catch(failed)
  }),

  /**
   * The Options page's Save: every edited option, the card order and the checkout layout in one
   * transaction, so a half-saved page never reaches checkout.
   */
  saveOptions: can(permissions.SETTINGS_MANAGE)
    .input(
      z.object({
        layout: z.enum(DELIVERY_LAYOUTS).optional(),
        options: z.array(OptionEditSchema).max(20),
      }),
    )
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      const storeId = context.scope.storeId
      const saved = []
      for (const edit of input.options) {
        saved.push(
          await saveDeliveryOption(context.tx, storeId, edit.id, edit.option).catch(failed),
        )
      }
      const known = await loadDeliveryConfig(context.tx, storeId)
      const listed = new Set(saved.map((o) => o.id))
      // The page's order first, then any option it did not send (added elsewhere meanwhile).
      const ids = [
        ...saved.map((o) => o.id),
        ...known.options.filter((o) => !listed.has(o.id)).map((o) => o.id),
      ]
      await reorderDeliveryOptions(context.tx, ids)
      if (input.layout) await saveDeliveryLayout(context.tx, storeId, input.layout)
      return { ok: true, ids: saved.map((o) => o.id) }
    }),

  option: can(permissions.SETTINGS_READ)
    .input(z.object({ id: z.uuid() }))
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      const config = await loadDeliveryConfig(context.tx, context.scope.storeId)
      const option = config.options.find((o) => o.id === input.id)
      if (!option)
        throw new ORPCError('NOT_FOUND', { message: 'This delivery option no longer exists.' })
      return option
    }),

  saveOption: can(permissions.SETTINGS_MANAGE)
    .input(z.object({ id: z.uuid().nullable(), option: DeliveryOptionInputSchema }))
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      return saveDeliveryOption(context.tx, context.scope.storeId, input.id, input.option).catch(
        failed,
      )
    }),

  deleteOption: can(permissions.SETTINGS_MANAGE)
    .input(z.object({ id: z.uuid() }))
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      await deleteDeliveryOption(context.tx, input.id)
      return { ok: true }
    }),

  reorderOptions: can(permissions.SETTINGS_MANAGE)
    .input(z.object({ ids: z.array(z.uuid()).max(BULK_MAX) }))
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      await reorderDeliveryOptions(context.tx, input.ids)
      return { ok: true }
    }),

  addPreset: can(permissions.SETTINGS_MANAGE).handler(async ({ context }) => {
    await requireInstalled(context)
    return addPresetOptions(context.tx, context.scope.storeId)
  }),

  saveRule: can(permissions.SETTINGS_MANAGE)
    .input(z.object({ id: z.uuid().nullable(), rule: RouteRuleInputSchema }))
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      return saveRouteRule(context.tx, context.scope.storeId, input.id, input.rule).catch(failed)
    }),

  deleteRule: can(permissions.SETTINGS_MANAGE)
    .input(z.object({ id: z.uuid() }))
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      await deleteRouteRule(context.tx, input.id)
      return { ok: true }
    }),

  reorderRules: can(permissions.SETTINGS_MANAGE)
    .input(z.object({ ids: z.array(z.uuid()).max(BULK_MAX) }))
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      await reorderRouteRules(context.tx, input.ids)
      return { ok: true }
    }),

  saveRouteSetting: can(permissions.SETTINGS_MANAGE)
    .input(RouteSettingInputSchema)
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      return saveRouteSetting(context.tx, context.scope.storeId, input)
    }),

  deleteRouteSetting: can(permissions.SETTINGS_MANAGE)
    .input(z.object({ key: z.string().min(1).max(160) }))
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      await deleteRouteSetting(context.tx, input.key)
      return { ok: true }
    }),

  /** Delhivery Protect's card: rates per category and product-type overrides (the overview
   *  returns it as `protect`). Booking, checkout and the margin read it. */
  saveProtect: can(permissions.SETTINGS_MANAGE)
    .input(ProtectCardSchema)
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      return saveProtectCard(context.tx, context.scope.storeId, input)
    }),

  /** Try a PIN: the cards checkout would show, every route's quote, and why. Calls couriers. */
  tryPin: can(permissions.SETTINGS_READ)
    .input(
      z.object({
        pincode: z
          .string()
          .trim()
          .regex(/^[1-9]\d{5}$/),
        valuePaise: z.number().int().min(0).max(100_000_000),
        weightGrams: z.number().int().min(1).max(100_000),
        productIds: z.array(z.uuid()).max(BULK_MAX).default([]),
        /** Pick products mode: the parcel is built from these, as checkout builds it. */
        lines: z
          .array(z.object({ variantId: z.uuid(), quantity: z.number().int().min(1).max(999) }))
          .max(BULK_MAX)
          .optional(),
        declineInsurance: z.boolean().default(false),
        /** The Options page's unsaved edits, priced instead of what is saved. */
        draft: DraftSchema.optional(),
        /** A preview: answers checkout cached stand in for live calls. */
        cached: z.boolean().default(false),
      }),
    )
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      const { providers, settings } = await providersOf(context)
      const cache = input.cached ? (context.deliveryHealth ?? null) : null
      return tryDeliveryPin(
        context.tx,
        context.scope.storeId,
        providers,
        settings,
        input,
        new Date(),
        cache,
      ).catch(failed)
    }),
}
