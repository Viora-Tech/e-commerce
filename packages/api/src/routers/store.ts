import { loadEnv, settingsSecret } from '@commerce/config'
import {
  checkRateLimit,
  createMemoryRateLimitStore,
  enqueueAppJob,
  ensureMainTheme,
  GstinSchema,
  GstRegistrationError,
  keepReplacedKeySets,
  liveThemeSettings,
  loadStoreStorageSettings,
  NotificationSettingsSchema,
  PaymentSettingsSchema,
  PreorderStoreSettingsSchema,
  parseNotificationSettings,
  parsePaymentSettings,
  parsePreferences,
  parsePreorderStoreSettings,
  parsePreviousSecrets,
  parseShippingSettings,
  permissions,
  presentStoreGeneral,
  rateLimitKey,
  retryAfterSeconds,
  SETUP_ITEM_IDS,
  ShippingSettingsSchema,
  StorageSettingsSchema,
  StoreGeneralSchema,
  StorePreferencesSchema,
  signThemePreviewToken,
  storefrontOriginFor,
  ThemeSchema,
  updateThemeSettings,
} from '@commerce/core'
import { CORE_PLUGIN_ID } from '@commerce/plugins'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { can, storeProcedure } from '../procedures'
import { storeRegistries } from '../services/apps.service'
import {
  loadStorageSettings,
  testStorageConnection,
  updateStoreStorage,
  verifyStorageCredentials,
} from '../services/media.service'
import { testPaymentConnection } from '../services/payments-setup.service'
import {
  availableProviders,
  prepareProviderSettings,
  presentProviderSettings,
} from '../services/provider-settings'
import { settingsChecklist } from '../services/settings-home.service'
import {
  TEST_CONNECTION_RULE,
  testShippingConnection,
  tryEstimate,
  updateStoreShipping,
  verifyShippingCredentials,
} from '../services/shipping.service'

import {
  getStore,
  presentStore,
  updateStoreGeneral,
  updateStoreNotifications,
  updateStorePayments,
  updateStorePreferences,
  updateStorePreorder,
} from '../services/store.service'

const previousSecrets = () => parsePreviousSecrets(loadEnv(process.env).SETTINGS_SECRET_PREVIOUS)

/**
 * In-process fallback for hosts (and tests) that don't wire a Redis-backed
 * rate limit store into the context. Fine for a single admin instance;
 * `apps/admin/src/lib/api.ts` wires a real one for the deployed app.
 */
const fallbackRateLimit = createMemoryRateLimitStore()

/**
 * A courier Connect page's read-only "Test connection": the form's values (a masked secret
 * means the saved one) through the courier's own serviceability lookup. Rate-limited per
 * store so a mistyped token can't be hammered into a credential-guessing loop against the
 * real courier account.
 */
function courierConnectionTest(providerId: string) {
  return can(permissions.SETTINGS_MANAGE)
    .input(z.object({ fields: z.record(z.string(), z.string()) }))
    .handler(async ({ context, input }) => {
      const limit = await checkRateLimit(
        context.rateLimit ?? fallbackRateLimit,
        rateLimitKey('shipping-test-connection', context.scope.storeId),
        TEST_CONNECTION_RULE,
      )
      if (!limit.ok) {
        throw new ORPCError('TOO_MANY_REQUESTS', {
          message: `Too many attempts. Try again in about ${Math.ceil(retryAfterSeconds(limit) / 60)} minute(s).`,
        })
      }
      const { shipping } = await storeRegistries(context.tx, context.scope.storeId)
      return testShippingConnection(
        context.tx,
        context.scope.storeId,
        shipping,
        settingsSecret(),
        providerId,
        input.fields,
      )
    })
}

export const storeRouter = {
  current: can(permissions.SETTINGS_READ).handler(async ({ context }) => {
    const { storeId } = context.scope
    const s = await getStore(context.tx, storeId)
    if (!s) return null
    return {
      ...presentStore(s),
      theme: await liveThemeSettings(context.tx, storeId),
      role: context.scope.role,
    }
  }),

  /**
   * The store's public web address (`https://<live primary domain>`, STOREFRONT_URL only
   * when it has none): every admin "View store", preview and share link starts here. Bare
   * `storeProcedure` on purpose (docs/guardrails.md): it is the address shoppers already
   * see, and staff without `settings.read` still need working links.
   */
  origin: storeProcedure.handler(({ context }) =>
    storefrontOriginFor(context.tx, context.scope.storeId, loadEnv(process.env).STOREFRONT_URL),
  ),

  /** The Settings home's setup checklist: what is done, from real data. */
  setupChecklist: can(permissions.SETTINGS_READ)
    .input(z.object({ after: z.enum(SETUP_ITEM_IDS).optional() }).optional())
    .handler(({ context, input }) =>
      settingsChecklist(context.tx, context.scope.storeId, input?.after),
    ),

  /** Store details for Settings › General. */
  getGeneral: can(permissions.SETTINGS_READ).handler(async ({ context }) => {
    const s = await getStore(context.tx, context.scope.storeId)
    return s ? presentStoreGeneral(s) : null
  }),

  updateGeneral: can(permissions.SETTINGS_MANAGE)
    // GSTIN and rate are optional here: Settings › Taxes & GST owns them, and a
    // General save that leaves them out must not reset them to the defaults.
    .input(
      StoreGeneralSchema.extend({
        gstin: GstinSchema.optional(),
        gstRatePercent: z.coerce.number().min(0).max(40).optional(),
        moneyFormat: StoreGeneralSchema.shape.moneyFormat.optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const empty = (v: string) => (v === '' ? null : v)
      const s = await updateStoreGeneral(context.tx, context.scope.storeId, {
        name: input.name,
        contactEmail: empty(input.contactEmail),
        contactPhone: empty(input.contactPhone),
        address: input.address,
        ...(input.gstin === undefined ? {} : { gstin: empty(input.gstin) }),
        ...(input.gstRatePercent === undefined
          ? {}
          : { gstRatePercent: Math.round(input.gstRatePercent) }),
        timezone: input.timezone,
        ...(input.moneyFormat === undefined ? {} : { moneyFormat: empty(input.moneyFormat) }),
      }).catch((err: unknown) => {
        if (err instanceof GstRegistrationError) {
          throw new ORPCError('BAD_REQUEST', { message: err.message, data: { code: err.code } })
        }
        throw err
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
      previewToken: signThemePreviewToken({ secret: settingsSecret(), storeId }),
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
      settings: presentProviderSettings(
        parsePaymentSettings(s?.payments),
        settingsSecret(),
        payments,
        previousSecrets(),
      ),
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
      // Keys of the other mode replacing a gateway's set keep the replaced set waiting.
      const next = prepareProviderSettings(
        { ...input, providers: keepReplacedKeySets(current.providers, input.providers) },
        current,
        payments,
        settingsSecret(),
        'payment provider',
      )
      const saved = await updateStorePayments(context.tx, context.scope.storeId, next)
      return saved
        ? presentProviderSettings(
            parsePaymentSettings(saved.payments),
            settingsSecret(),
            payments,
            previousSecrets(),
          )
        : null
    }),

  /** Pre-order balance rules: automatic request, reminders, what an unpaid balance does. */
  getPreorder: can(permissions.SETTINGS_READ).handler(async ({ context }) => {
    const s = await getStore(context.tx, context.scope.storeId)
    return parsePreorderStoreSettings(s?.preorder)
  }),

  updatePreorder: can(permissions.SETTINGS_MANAGE)
    .input(PreorderStoreSettingsSchema)
    .handler(async ({ context, input }) => {
      const saved = await updateStorePreorder(context.tx, context.scope.storeId, input)
      return parsePreorderStoreSettings(saved?.preorder)
    }),

  /** Notification settings with secrets masked, plus the channels this deployment can offer. */
  getNotifications: can(permissions.SETTINGS_READ).handler(async ({ context }) => {
    const s = await getStore(context.tx, context.scope.storeId)
    const { notifications } = await storeRegistries(context.tx, context.scope.storeId)
    return {
      settings: presentProviderSettings(
        parseNotificationSettings(s?.notifications),
        settingsSecret(),
        notifications,
        previousSecrets(),
      ),
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
        settingsSecret(),
        'notification channel',
      )
      const saved = await updateStoreNotifications(context.tx, context.scope.storeId, next)
      return saved
        ? presentProviderSettings(
            parseNotificationSettings(saved.notifications),
            settingsSecret(),
            notifications,
            previousSecrets(),
          )
        : null
    }),

  /** Shipping settings with secrets masked, the couriers on offer, and the dispatch policy. */
  getShipping: can(permissions.SETTINGS_READ).handler(async ({ context }) => {
    const s = await getStore(context.tx, context.scope.storeId)
    const { shipping } = await storeRegistries(context.tx, context.scope.storeId)
    return {
      settings: presentProviderSettings(
        parseShippingSettings(s?.shipping),
        settingsSecret(),
        shipping,
        previousSecrets(),
      ),
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
      const next = prepareProviderSettings(input, current, shipping, settingsSecret(), 'courier')
      const saved = await updateStoreShipping(context.tx, context.scope.storeId, next)
      return saved
        ? presentProviderSettings(
            parseShippingSettings(saved.shipping),
            settingsSecret(),
            shipping,
            previousSecrets(),
          )
        : null
    }),

  /** "Try a PIN" on the settings page: the exact answer the storefront would give. */
  estimateDelivery: can(permissions.SETTINGS_READ)
    .input(z.object({ pincode: z.string().trim().max(10) }))
    .handler(async ({ context, input }) => {
      const { shipping } = await storeRegistries(context.tx, context.scope.storeId)
      return tryEstimate(
        context.tx,
        context.scope.storeId,
        shipping,
        settingsSecret(),
        input.pincode,
      )
    }),

  verifyShipping: can(permissions.SETTINGS_READ).handler(async ({ context }) => {
    const { shipping } = await storeRegistries(context.tx, context.scope.storeId)
    return verifyShippingCredentials(context.tx, context.scope.storeId, shipping, settingsSecret())
  }),

  /**
   * Each courier Connect page's "Test connection" button (see `courierConnectionTest`).
   * One procedure per courier so a page's types follow its own provider.
   */
  testDelhiveryConnection: courierConnectionTest('delhivery'),
  testShiprocketConnection: courierConnectionTest('shiprocket'),
  testRapidshypConnection: courierConnectionTest('rapidshyp'),
  testXpressbeesConnection: courierConnectionTest('xpressbees'),
  testEkartConnection: courierConnectionTest('ekart'),
  testShadowfaxConnection: courierConnectionTest('shadowfax'),
  testDhlExpressConnection: courierConnectionTest('dhl-express'),
  testFedexConnection: courierConnectionTest('fedex'),

  /**
   * The Decentro Connect page's "Test connection": the form's values (a
   * masked secret means the saved one) through Decentro's read-only status
   * lookup. Nothing is saved or created.
   */
  testDecentroConnection: can(permissions.SETTINGS_MANAGE)
    .input(z.object({ fields: z.record(z.string(), z.string()) }))
    .handler(async ({ context, input }) => {
      const limit = await checkRateLimit(
        context.rateLimit ?? fallbackRateLimit,
        rateLimitKey('payments-test-connection', context.scope.storeId),
        TEST_CONNECTION_RULE,
      )
      if (!limit.ok) {
        throw new ORPCError('TOO_MANY_REQUESTS', {
          message: `Too many attempts. Try again in about ${Math.ceil(retryAfterSeconds(limit) / 60)} minute(s).`,
        })
      }
      const { payments } = await storeRegistries(context.tx, context.scope.storeId)
      return testPaymentConnection(
        context.tx,
        context.scope.storeId,
        payments,
        { secret: settingsSecret(), previousSecrets: previousSecrets() },
        'decentro',
        input.fields,
      )
    }),

  /** Storage settings with secrets masked, plus the providers this deployment can offer. */
  getStorage: can(permissions.SETTINGS_READ).handler(async ({ context }) => {
    const { storage } = await storeRegistries(context.tx, context.scope.storeId)
    return {
      settings: presentProviderSettings(
        await loadStorageSettings(context.tx, context.scope.storeId),
        settingsSecret(),
        storage,
        previousSecrets(),
      ),
      available: availableProviders(storage),
    }
  }),

  updateStorage: can(permissions.SETTINGS_MANAGE)
    .input(StorageSettingsSchema)
    .handler(async ({ context, input }) => {
      const current = await loadStorageSettings(context.tx, context.scope.storeId)
      const { storage } = await storeRegistries(context.tx, context.scope.storeId)
      const next = prepareProviderSettings(
        input,
        current,
        storage,
        settingsSecret(),
        'storage provider',
      )
      const saved = await updateStoreStorage(context.tx, context.scope.storeId, next)
      return saved
        ? presentProviderSettings(
            await loadStorageSettings(context.tx, context.scope.storeId),
            settingsSecret(),
            storage,
            previousSecrets(),
          )
        : null
    }),

  verifyStorage: can(permissions.SETTINGS_READ).handler(async ({ context }) => {
    const { storage } = await storeRegistries(context.tx, context.scope.storeId)
    return verifyStorageCredentials(context.tx, context.scope.storeId, storage, settingsSecret())
  }),

  /**
   * A storage Connect page's "Test connection" button (e.g. Amazon S3's guided page):
   * validates the form's current, unsaved field values against the real provider before the
   * merchant commits to Save. Rate-limited per store like the shipping/payments equivalents.
   */
  testStorageConnection: can(permissions.SETTINGS_MANAGE)
    .input(z.object({ providerId: z.string().min(1), fields: z.record(z.string(), z.string()) }))
    .handler(async ({ context, input }) => {
      const limit = await checkRateLimit(
        context.rateLimit ?? fallbackRateLimit,
        rateLimitKey('storage-test-connection', context.scope.storeId),
        TEST_CONNECTION_RULE,
      )
      if (!limit.ok) {
        throw new ORPCError('TOO_MANY_REQUESTS', {
          message: `Too many attempts. Try again in about ${Math.ceil(retryAfterSeconds(limit) / 60)} minute(s).`,
        })
      }
      const { storage } = await storeRegistries(context.tx, context.scope.storeId)
      return testStorageConnection(
        context.tx,
        context.scope.storeId,
        storage,
        settingsSecret(),
        input.providerId,
        input.fields,
      )
    }),

  /** "Move existing files to <connection>": queues the worker job; see packages/core/src/media/migrate.ts. */
  migrateStorage: can(permissions.SETTINGS_MANAGE)
    .input(z.object({ targetProviderId: z.string().min(1) }))
    .handler(async ({ context, input }) => {
      const { storage } = await storeRegistries(context.tx, context.scope.storeId)
      if (!storage.get(input.targetProviderId)) {
        throw new ORPCError('BAD_REQUEST', {
          message: `Unknown storage provider "${input.targetProviderId}"`,
        })
      }
      if (!context.appJobs) {
        throw new ORPCError('INTERNAL_SERVER_ERROR', {
          message: 'Background jobs are not available here',
        })
      }
      await enqueueAppJob(
        context.appJobs,
        {
          storeId: context.scope.storeId,
          pluginId: CORE_PLUGIN_ID,
          name: 'migrateStorage',
          data: { targetProviderId: input.targetProviderId },
        },
        // One run at a time per target; a second click while it's going is a no-op, not a second job.
        `migrateStorage:${input.targetProviderId}`,
      )
      return { ok: true }
    }),

  /** Progress the admin polls while "Move existing files to <connection>" runs. */
  storageMigrationStatus: can(permissions.SETTINGS_READ).handler(async ({ context }) => {
    const settings = await loadStoreStorageSettings(context.tx, context.scope.storeId)
    return settings.migration
  }),
}
