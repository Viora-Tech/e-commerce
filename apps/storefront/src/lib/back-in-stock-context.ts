import 'server-only'
import { parseAppsSettings, parseNotificationSettings } from '@commerce/core'
import { type StoreTx, store } from '@commerce/db'
import { BACK_IN_STOCK_ID, loadStoreSettings } from '@commerce/plugin-back-in-stock/server'
import { eq } from 'drizzle-orm'

export type BackInStockContext = {
  installed: boolean
  /** Whether the form asks for a WhatsApp number. */
  whatsappEnabled: boolean
  /** The merchant's "Button text"; null keeps the form's own default ("Notify me"). */
  buttonText: string | null
}

/**
 * Whether the storefront should offer a "notify me" form: the app is
 * installed for this store, and (for the WhatsApp field) the store both has
 * a WhatsApp channel configured and turned WhatsApp alerts on in the app's
 * own settings, and kept "Ask for a phone number" on (the default). The button's words come
 * from the app's "Button text" setting when the merchant chose one.
 */
export async function backInStockContext(
  tx: StoreTx,
  storeId: string,
): Promise<BackInStockContext> {
  const [s] = await tx
    .select({ apps: store.apps, notifications: store.notifications })
    .from(store)
    .where(eq(store.id, storeId))
  const installed = parseAppsSettings(s?.apps).installed.includes(BACK_IN_STOCK_ID)
  if (!installed) return { installed: false, whatsappEnabled: false, buttonText: null }
  const hasWhatsappChannel = parseNotificationSettings(s?.notifications).enabled.includes(
    'whatsapp',
  )
  const settings = await loadStoreSettings(tx, storeId)
  return {
    installed: true,
    whatsappEnabled: hasWhatsappChannel && settings.whatsappEnabled && settings.askPhone,
    buttonText: settings.buttonText || null,
  }
}
