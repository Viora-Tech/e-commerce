import 'server-only'
import { parseAppsSettings, parseNotificationSettings } from '@commerce/core'
import { type StoreTx, store } from '@commerce/db'
import { BACK_IN_STOCK_ID, loadStoreSettings } from '@commerce/plugin-back-in-stock/server'
import { eq } from 'drizzle-orm'

export type BackInStockContext = { installed: boolean; whatsappEnabled: boolean }

/**
 * Whether the storefront should offer a "notify me" form: the app is
 * installed for this store, and (for the WhatsApp field) the store both has
 * a WhatsApp channel configured and turned WhatsApp alerts on in the app's
 * own settings.
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
  if (!installed) return { installed: false, whatsappEnabled: false }
  const hasWhatsappChannel = parseNotificationSettings(s?.notifications).enabled.includes(
    'whatsapp',
  )
  const settings = await loadStoreSettings(tx, storeId)
  return { installed: true, whatsappEnabled: hasWhatsappChannel && settings.whatsappEnabled }
}
