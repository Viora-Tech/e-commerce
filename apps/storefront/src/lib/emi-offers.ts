import { appSettingsOf, parseAppsSettings, parsePaymentSettings } from '@commerce/core'
import { type StoreTx, store } from '@commerce/db'
import {
  EMI_PAY_LATER_ID,
  type EmiOffersConfig,
  emiOffersConfig,
  parseEmiWidgetSettings,
} from '@commerce/plugin-emi/offer'
import { eq } from 'drizzle-orm'

/**
 * `installed: false` leaves the product page on its older built-in EMI hint.
 * Once the EMI & pay later app is installed it owns the line under the price:
 * `config` is null (nothing shown) until the app is on, its gateway is set up
 * and EMI is on at checkout.
 */
export type StoreEmiOffers = { installed: boolean; config: EmiOffersConfig | null }

export async function storeEmiOffers(tx: StoreTx, storeId: string): Promise<StoreEmiOffers> {
  const [s] = await tx
    .select({ apps: store.apps, payments: store.payments })
    .from(store)
    .where(eq(store.id, storeId))
  const apps = parseAppsSettings(s?.apps)
  if (!apps.installed.includes(EMI_PAY_LATER_ID)) return { installed: false, config: null }
  const settings = parseEmiWidgetSettings(appSettingsOf(apps, EMI_PAY_LATER_ID))
  return { installed: true, config: emiOffersConfig(settings, parsePaymentSettings(s?.payments)) }
}
