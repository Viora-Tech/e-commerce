import { loadEnv } from '@commerce/config'
import {
  ensureMainTheme,
  liveThemeSettings,
  NotificationSettingsSchema,
  PaymentSettingsSchema,
  parseNotificationSettings,
  parsePaymentSettings,
  parsePreferences,
  parseShippingSettings,
  permissions,
  presentStoreGeneral,
  ShippingSettingsSchema,
  StorageSettingsSchema,
  StoreGeneralSchema,
  StorePreferencesSchema,
  signThemePreviewToken,
  ThemeSchema,
  updateThemeSettings,
} from '@commerce/core'
import { z } from 'zod'
import { can } from '../procedures'
import { storeRegistries } from '../services/apps.service'
import {
  loadStorageSettings,
  updateStoreStorage,
  verifyStorageCredentials,
} from '../services/media.service'
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
  updateStoreGeneral,
  updateStoreNotifications,
  updateStorePayments,
  updateStorePreferences,
} from '../services/store.service'

const secret = () => loadEnv(process.env).SETTINGS_SECRET

export const storeRouter = {
  current: can(permissions.SETTINGS_READ).handler(async ({ context }) => {
    const { storeId } = context.scope
    const s = await getStore(context.tx, storeId)
    if (!s) return null
    return { ...s, theme: await liveThemeSettings(context.tx, storeId), role: context.scope.role }
  }),

  /** Store details for Settings › General. */
  getGeneral: can(permissions.SETTINGS_READ).handler(async ({ context }) => {
    const s = await getStore(context.tx, context.scope.storeId)
    return s ? presentStoreGeneral(s) : null
  }),

  updateGeneral: can(permissions.SETTINGS_MANAGE)
    .input(StoreGeneralSchema)
    .handler(async ({ context, input }) => {
      const empty = (v: string) => (v === '' ? null : v)
      const s = await updateStoreGeneral(context.tx, context.scope.storeId, {
        name: input.name,
        contactEmail: empty(input.contactEmail),
        contactPhone: empty(input.contactPhone),
        address: input.address,
        gstin: empty(input.gstin),
        gstRatePercent: Math.round(input.gstRatePercent),
        timezone: input.timezone,
      })
      return s ? presentStoreGeneral(s) : null
    }),

  /**
   * The storefront theme for Online Store › Themes, with a short-lived token that
   * lets the storefront accept live (unsaved) theme changes from the editor frame.
   */
  /** The live theme's settings. Kept for callers that predate the theme library (`themes.*`). */
  getTheme: can(permissions.ONLINE_STORE_READ).handler(async ({ context }) => {
    const { storeId } = context.scope
    const main = await ensureMainTheme(context.tx, storeId)
    return {
      theme: main.settings,
      previewToken: signThemePreviewToken({ secret: secret(), storeId }),
    }
  }),

  /** Saves the live theme's settings. Theme editing lives under Online Store, so it is an online store permission. */
  updateTheme: can(permissions.ONLINE_STORE_WRITE)
    .input(ThemeSchema)
    .handler(async ({ context, input }) => {
      const main = await ensureMainTheme(context.tx, context.scope.storeId)
      const saved = await updateThemeSettings(context.tx, main.id, input)
      return saved.settings
    }),

  /** Online Store › Preferences: SEO defaults, password page, privacy banner and tracking. */
  getPreferences: can(permissions.ONLINE_STORE_READ).handler(async ({ context }) => {
    const s = await getStore(context.tx, context.scope.storeId)
    return parsePreferences(s?.preferences)
  }),

  updatePreferences: can(permissions.ONLINE_STORE_WRITE)
    .input(StorePreferencesSchema)
    .handler(async ({ context, input }) => {
      const s = await updateStorePreferences(context.tx, context.scope.storeId, input)
      return parsePreferences(s?.preferences)
    }),

  /** Payment settings with secrets masked, plus the gateways this deployment can offer. */
  getPayments: can(permissions.SETTINGS_READ).handler(async ({ context }) => {
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
  updatePayments: can(permissions.SETTINGS_MANAGE)
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
  getNotifications: can(permissions.SETTINGS_READ).handler(async ({ context }) => {
    const s = await getStore(context.tx, context.scope.storeId)
    const { notifications } = await storeRegistries(context.tx, context.scope.storeId)
    return {
      settings: presentProviderSettings(parseNotificationSettings(s?.notifications), secret()),
      available: availableProviders(notifications),
    }
  }),

  updateNotifications: can(permissions.SETTINGS_MANAGE)
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
  getShipping: can(permissions.SETTINGS_READ).handler(async ({ context }) => {
    const s = await getStore(context.tx, context.scope.storeId)
    const { shipping } = await storeRegistries(context.tx, context.scope.storeId)
    return {
      settings: presentProviderSettings(parseShippingSettings(s?.shipping), secret()),
      available: availableProviders(shipping),
    }
  }),

  updateShipping: can(permissions.SETTINGS_MANAGE)
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
  estimateDelivery: can(permissions.SETTINGS_READ)
    .input(z.object({ pincode: z.string().trim().max(10) }))
    .handler(async ({ context, input }) => {
      const { shipping } = await storeRegistries(context.tx, context.scope.storeId)
      return tryEstimate(context.tx, context.scope.storeId, shipping, secret(), input.pincode)
    }),

  verifyShipping: can(permissions.SETTINGS_READ).handler(async ({ context }) => {
    const { shipping } = await storeRegistries(context.tx, context.scope.storeId)
    return verifyShippingCredentials(context.tx, context.scope.storeId, shipping, secret())
  }),

  /** Storage settings with secrets masked, plus the providers this deployment can offer. */
  getStorage: can(permissions.SETTINGS_READ).handler(async ({ context }) => {
    const { storage } = await storeRegistries(context.tx, context.scope.storeId)
    return {
      settings: presentProviderSettings(
        await loadStorageSettings(context.tx, context.scope.storeId),
        secret(),
      ),
      available: availableProviders(storage),
    }
  }),

  updateStorage: can(permissions.SETTINGS_MANAGE)
    .input(StorageSettingsSchema)
    .handler(async ({ context, input }) => {
      const current = await loadStorageSettings(context.tx, context.scope.storeId)
      const { storage } = await storeRegistries(context.tx, context.scope.storeId)
      const next = prepareProviderSettings(input, current, storage, secret(), 'storage provider')
      const saved = await updateStoreStorage(context.tx, context.scope.storeId, next)
      return saved
        ? presentProviderSettings(
            await loadStorageSettings(context.tx, context.scope.storeId),
            secret(),
          )
        : null
    }),

  verifyStorage: can(permissions.SETTINGS_READ).handler(async ({ context }) => {
    const { storage } = await storeRegistries(context.tx, context.scope.storeId)
    return verifyStorageCredentials(context.tx, context.scope.storeId, storage, secret())
  }),
}
