import { settingsSecret } from '@commerce/config'
import {
  addPresetOptions,
  type DeliveryHealth,
  DeliveryOptionInputSchema,
  deleteDeliveryOption,
  deleteRouteRule,
  deleteRouteSetting,
  deliveryHealth,
  deliveryOptionsInstalled,
  deliveryOverview,
  loadDeliveryConfig,
  permissions,
  RouteRuleInputSchema,
  RouteSettingInputSchema,
  reorderDeliveryOptions,
  reorderRouteRules,
  resolveShippingProviders,
  saveDeliveryOption,
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

const NO_HEALTH: DeliveryHealth = { apps: [], checkouts24h: 0, backup24h: 0 }

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
    const overview = await deliveryOverview(context.tx, providers)
    // What checkout recorded: each app's recent calls and breaker, and the backup share.
    const health = context.deliveryHealth
      ? await deliveryHealth(
          context.deliveryHealth,
          context.scope.storeId,
          overview.apps.map((a) => a.id),
        ).catch(() => NO_HEALTH)
      : NO_HEALTH
    return { ...overview, health }
  }),

  option: can(permissions.SETTINGS_READ)
    .input(z.object({ id: z.uuid() }))
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      const config = await loadDeliveryConfig(context.tx)
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
        declineInsurance: z.boolean().default(false),
      }),
    )
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      const { providers, settings } = await providersOf(context)
      return tryDeliveryPin(context.tx, context.scope.storeId, providers, settings, input).catch(
        failed,
      )
    }),
}
