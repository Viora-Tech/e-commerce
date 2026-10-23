import { settingsSecret } from '@commerce/config'
import {
  completeWhatsappSignup,
  decryptSecret,
  encryptSecret,
  linkPlatformAccount,
  loadPlatformAccount,
  META_GRAPH_VERSION,
  parseNotificationSettings,
  permissions,
  unlinkPlatformAccount,
  WhatsappSignupError,
  WhatsappSignupSchema,
  whatsappSignupApp,
} from '@commerce/core'
import { ORPCError } from '@orpc/server'
import { can } from '../procedures'
import { storeRegistries } from '../services/apps.service'
import { prepareProviderSettings } from '../services/provider-settings'
import { getStore, updateStoreNotifications } from '../services/store.service'

const WHATSAPP = 'whatsapp'

/** What the WhatsApp page shows about the connected account; the PIN never leaves the server. */
function accountView(row: Awaited<ReturnType<typeof loadPlatformAccount>>) {
  if (!row) return null
  const { pin: _pin, ...detail } = row.detail
  return {
    wabaId: row.externalId,
    status: row.status,
    detail,
    connectedAt: row.createdAt.toISOString(),
    lastEventAt: row.lastEventAt?.toISOString() ?? null,
  }
}

/**
 * The platform's own apps on outside platforms, as one store uses them. Today: WhatsApp
 * Embedded Signup (Apps → WhatsApp → "Connect with Facebook").
 */
export const platformAppsRouter = {
  /** Whether Embedded Signup is set up here, what the SDK needs, and the linked account. */
  whatsapp: can(permissions.SETTINGS_READ).handler(async ({ context }) => {
    const app = whatsappSignupApp(process.env)
    const row = await loadPlatformAccount(
      { tx: context.tx, storeId: context.scope.storeId },
      WHATSAPP,
    )
    return {
      signup: app
        ? { appId: app.appId, configId: app.configId, version: META_GRAPH_VERSION }
        : null,
      account: accountView(row),
    }
  }),

  /**
   * The popup finished: swap the code (it lives 30 seconds), subscribe, register the number,
   * then save it as the store's WhatsApp channel and turn the channel on.
   */
  completeWhatsapp: can(permissions.SETTINGS_MANAGE)
    .input(WhatsappSignupSchema)
    .handler(async ({ context, input }) => {
      const app = whatsappSignupApp(process.env)
      if (!app)
        throw new ORPCError('PRECONDITION_FAILED', {
          message: 'WhatsApp Embedded Signup is not set up on this deployment.',
        })
      const secret = settingsSecret()
      const ctx = { tx: context.tx, storeId: context.scope.storeId }
      const existing = await loadPlatformAccount(ctx, WHATSAPP)
      // Same number again: keep its PIN, so re-registering does not lock it.
      const keptPin =
        existing?.detail.phoneNumberId === input.phoneNumberId && existing.detail.pin
          ? decryptSecret(existing.detail.pin, secret)
          : undefined
      let result: Awaited<ReturnType<typeof completeWhatsappSignup>>
      try {
        result = await completeWhatsappSignup(fetch, app, input, keptPin)
      } catch (err) {
        if (err instanceof WhatsappSignupError)
          throw new ORPCError('BAD_REQUEST', { message: err.message })
        throw err
      }

      const current = parseNotificationSettings(
        (await getStore(context.tx, context.scope.storeId))?.notifications,
      )
      const { notifications } = await storeRegistries(context.tx, context.scope.storeId)
      const before = current.providers[WHATSAPP] ?? {}
      const next = prepareProviderSettings(
        {
          ...current,
          enabled: [...new Set([...current.enabled, WHATSAPP])],
          providers: {
            ...current.providers,
            [WHATSAPP]: {
              ...before,
              phoneNumberId: result.phoneNumberId,
              accessToken: result.accessToken,
              businessAccountId: result.wabaId,
              templateLanguage: before.templateLanguage || 'en',
              useTextMessages: 'false',
            },
          },
        },
        current,
        notifications,
        secret,
        'notification channel',
      )
      await updateStoreNotifications(context.tx, context.scope.storeId, next)
      await linkPlatformAccount(ctx, WHATSAPP, result.wabaId, {
        phoneNumberId: result.phoneNumberId,
        displayPhone: result.displayPhone ?? '',
        verifiedName: result.verifiedName ?? '',
        quality: result.quality ?? '',
        registered: result.registered ? 'yes' : 'no',
        ...(result.registerError ? { registerError: result.registerError.slice(0, 200) } : {}),
        pin: encryptSecret(result.pin, secret),
      })
      return accountView(await loadPlatformAccount(ctx, WHATSAPP))
    }),

  /** Forget the Embedded Signup account: the channel turns off and its saved access goes. */
  disconnectWhatsapp: can(permissions.SETTINGS_MANAGE).handler(async ({ context }) => {
    const ctx = { tx: context.tx, storeId: context.scope.storeId }
    const current = parseNotificationSettings(
      (await getStore(context.tx, context.scope.storeId))?.notifications,
    )
    const { [WHATSAPP]: _gone, ...providers } = current.providers
    await updateStoreNotifications(context.tx, context.scope.storeId, {
      ...current,
      enabled: current.enabled.filter((id) => id !== WHATSAPP),
      providers,
    })
    await unlinkPlatformAccount(ctx, WHATSAPP)
    return true
  }),
}
