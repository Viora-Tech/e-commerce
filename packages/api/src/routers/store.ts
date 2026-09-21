import { loadEnv } from '@commerce/config'
import {
  builtInNotificationRegistry,
  builtInPaymentRegistry,
  NotificationSettingsSchema,
  PaymentSettingsSchema,
  parseNotificationSettings,
  parsePaymentSettings,
  parseTheme,
  ThemeSchema,
} from '@commerce/core'
import { sesFactory } from '@commerce/notifications-ses'
import { whatsappFactory } from '@commerce/notifications-whatsapp'
import { razorpayFactory } from '@commerce/payments-razorpay'
import { storeProcedure } from '../procedures'
import {
  availableProviders,
  prepareProviderSettings,
  presentProviderSettings,
} from '../services/provider-settings'
import {
  getStore,
  updateStoreNotifications,
  updateStorePayments,
  updateStoreTheme,
} from '../services/store.service'

const payments = builtInPaymentRegistry().register(razorpayFactory)
const notifications = builtInNotificationRegistry().register(sesFactory).register(whatsappFactory)
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
      const next = prepareProviderSettings(input, current, payments, secret(), 'payment provider')
      const saved = await updateStorePayments(context.tx, context.scope.storeId, next)
      return saved ? presentProviderSettings(parsePaymentSettings(saved.payments), secret()) : null
    }),

  /** Notification settings with secrets masked, plus the channels this deployment can offer. */
  getNotifications: storeProcedure.handler(async ({ context }) => {
    const s = await getStore(context.tx, context.scope.storeId)
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
}
