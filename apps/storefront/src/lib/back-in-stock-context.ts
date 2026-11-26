import 'server-only'
import { parseAppsSettings, parseNotificationSettings } from '@commerce/core'
import { collectionProduct, type StoreTx, store } from '@commerce/db'
import {
  BACK_IN_STOCK_ID,
  campaignShowsOn,
  loadStoreSettings,
  type NotifyWidget,
  notifyWidgetOf,
} from '@commerce/plugin-back-in-stock/server'
import { eq } from 'drizzle-orm'

export type BackInStockContext = {
  /** The app is installed and its campaign is live and covers this product. */
  installed: boolean
  /** Whether the form asks for a WhatsApp number. */
  whatsappEnabled: boolean
  /** The merchant's "Button text"; null keeps the form's own default. */
  buttonText: string | null
  /** The button and pop-up words and look (Campaign › Button, Pop up); null when not shown. */
  widget: NotifyWidget | null
}

const OFF: BackInStockContext = {
  installed: false,
  whatsappEnabled: false,
  buttonText: null,
  widget: null,
}

/**
 * Whether the storefront should offer a "notify me" form on this product: the app is
 * installed, its campaign is live, and the campaign's "Show on" covers the product (every
 * product, its collections or the product itself). The WhatsApp field needs the store's
 * WhatsApp channel, WhatsApp alerts on and "Ask for a phone number" on. The widget carries the
 * campaign's button and pop-up settings.
 */
export async function backInStockContext(
  tx: StoreTx,
  storeId: string,
  productId?: string | undefined,
): Promise<BackInStockContext> {
  const [s] = await tx
    .select({ apps: store.apps, notifications: store.notifications })
    .from(store)
    .where(eq(store.id, storeId))
  const installed = parseAppsSettings(s?.apps).installed.includes(BACK_IN_STOCK_ID)
  if (!installed) return OFF
  const settings = await loadStoreSettings(tx, storeId)
  const collectionIds =
    productId && settings.showOn === 'collections'
      ? (
          await tx
            .select({ id: collectionProduct.collectionId })
            .from(collectionProduct)
            .where(eq(collectionProduct.productId, productId))
        ).map((r) => r.id)
      : []
  // No product (an app block on another page) only needs the campaign to be live.
  const shown = productId ? campaignShowsOn(settings, productId, collectionIds) : settings.enabled
  if (!shown) return OFF
  const hasWhatsappChannel = parseNotificationSettings(s?.notifications).enabled.includes(
    'whatsapp',
  )
  return {
    installed: true,
    whatsappEnabled: hasWhatsappChannel && settings.whatsappEnabled && settings.askPhone,
    buttonText: settings.buttonText || null,
    widget: notifyWidgetOf(settings),
  }
}
