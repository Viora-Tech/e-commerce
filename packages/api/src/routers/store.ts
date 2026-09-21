import { loadEnv } from '@commerce/config'
import {
  NotificationSettingsSchema,
  PaymentSettingsSchema,
  parseNotificationSettings,
  parsePaymentSettings,
  parseShippingSettings,
  parseTheme,
  ShippingSettingsSchema,
  ThemeSchema,
} from '@commerce/core'
import { z } from 'zod'
import { storeProcedure } from '../procedures'
import { storeRegistries } from '../services/apps.service'
import {
  availableProviders,
  prepareProviderSettings,
  presentProviderSettings,
} from '../services/provider-settings'
import {
  tryEstimate,
  updateStoreShipping,
  verifyShippingCredentials,
} from '../services/shipping.service'
import {
  getStore,
  updateStoreNotifications,
  updateStorePayments,
  updateStoreTheme,
} from '../services/store.service'

const secret = () => loadEnv(process.env).SETTINGS_SECRET

export const storeRouter = {
  current: storeProcedure.handler(async ({ context }) => {
    const s = await getStore(context.tx, context.scope.storeId)
    return s ? { ...s, theme: parseTheme(s.theme), role: context.scope.role } : null
  }),

  updateTheme: storeProcedure
    .input(ThemeSchema)
    .handler(({ context, input }) => updateStoreTheme(context.tx, context.scope.storeId, input)),

  /** Payment settings with secrets masked, plus the gateways this deployment can offer. */
  getPayments: storeProcedure.handler(async ({ context }) => {
    const s = await getStore(context.tx, context.scope.storeId)
    const { payments } = await storeRegistries(context.tx, context.scope.storeId)
    return {
      settings: presentProviderSettings(parsePaymentSettings(s?.payments), secret()),
      available: availableProviders(payments),
    }
  }),

  /**
   * Save payment settings. A masked secret value (••••1234) means "unchanged":
   * the stored encrypted value is kept. Anything else is encrypted before saving.
   */
  updatePayments: storeProcedure
    .input(PaymentSettingsSchema)
    .handler(async ({ context, input }) => {
      const current = parsePaymentSettings(
        (await getStore(context.tx, context.scope.storeId))?.payments,
      )
      const { payments } = await storeRegistries(context.tx, context.scope.storeId)
      const next = prepareProviderSettings(input, current, payments, secret(), 'payment provider')
      const saved = await updateStorePayments(context.tx, context.scope.storeId, next)
      return saved ? presentProviderSettings(parsePaymentSettings(saved.payments), secret()) : null
    }),

  /** Notification settings with secrets masked, plus the channels this deployment can offer. */
  getNotifications: storeProcedure.handler(async ({ context }) => {
    const s = await getStore(context.tx, context.scope.storeId)
    const { notifications } = await storeRegistries(context.tx, context.scope.storeId)
    return {
      settings: presentProviderSettings(parseNotificationSettings(s?.notifications), secret()),
      available: availableProviders(notifications),
    }
  }),

  updateNotifications: storeProcedure
    .input(NotificationSettingsSchema)
    .handler(async ({ context, input }) => {
      const current = parseNotificationSettings(
        (await getStore(context.tx, context.scope.storeId))?.notifications,
      )
      const { notifications } = await storeRegistries(context.tx, context.scope.storeId)
      const next = prepareProviderSettings(
        input,
        current,
        notifications,
        secret(),
        'notification channel',
      )
      const saved = await updateStoreNotifications(context.tx, context.scope.storeId, next)
      return saved
        ? presentProviderSettings(parseNotificationSettings(saved.notifications), secret())
        : null
    }),

  /** Shipping settings with secrets masked, the couriers on offer, and the dispatch policy. */
  getShipping: storeProcedure.handler(async ({ context }) => {
    const s = await getStore(context.tx, context.scope.storeId)
    const { shipping } = await storeRegistries(context.tx, context.scope.storeId)
    return {
      settings: presentProviderSettings(parseShippingSettings(s?.shipping), secret()),
      available: availableProviders(shipping),
    }
  }),

  updateShipping: storeProcedure
    .input(ShippingSettingsSchema)
    .handler(async ({ context, input }) => {
      const current = parseShippingSettings(
        (await getStore(context.tx, context.scope.storeId))?.shipping,
      )
      const { shipping } = await storeRegistries(context.tx, context.scope.storeId)
      const next = prepareProviderSettings(input, current, shipping, secret(), 'courier')
      const saved = await updateStoreShipping(context.tx, context.scope.storeId, next)
      return saved ? presentProviderSettings(parseShippingSettings(saved.shipping), secret()) : null
    }),

  /** "Try a PIN" on the settings page: the exact answer the storefront would give. */
  estimateDelivery: storeProcedure
    .input(z.object({ pincode: z.string().trim().max(10) }))
    .handler(async ({ context, input }) => {
      const { shipping } = await storeRegistries(context.tx, context.scope.storeId)
      return tryEstimate(context.tx, context.scope.storeId, shipping, secret(), input.pincode)
    }),

  verifyShipping: storeProcedure.handler(async ({ context }) => {
    const { shipping } = await storeRegistries(context.tx, context.scope.storeId)
    return verifyShippingCredentials(context.tx, context.scope.storeId, shipping, secret())
  }),
}
