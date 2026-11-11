import {
  appSettingsOf,
  lockStoreApps,
  parseAppsSettings,
  parsePaymentSettings,
  withAppSettings,
} from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { store } from '@commerce/db'
import {
  applyEmiSettingsPatch,
  EMI_PAY_LATER_ID,
  type EmiReadiness,
  type EmiWidgetSettings,
  type EmiWidgetSettingsPatch,
  emiReadiness,
  parseEmiWidgetSettings,
  razorpayKeyIdOf,
} from '@commerce/plugin-emi/offer'
import { eq } from 'drizzle-orm'

/** What the app's settings page shows: the saved settings and whether shoppers see an offer yet. */
export type EmiSettingsView = {
  settings: EmiWidgetSettings
  readiness: EmiReadiness
  /** True when Razorpay's own widget will show (Razorpay chosen and a key id saved). */
  officialWidget: boolean
  /** Gateways the store has turned on, so the page can say which still need setting up. */
  gatewaysOn: string[]
}

async function loadRow(tx: StoreTx, storeId: string, lock = false) {
  // About to write store.apps back: hold the row lock first (lockStoreApps), so no writer is lost.
  if (lock) await lockStoreApps(tx, storeId)
  const [s] = await tx
    .select({ apps: store.apps, payments: store.payments })
    .from(store)
    .where(eq(store.id, storeId))
  return { apps: parseAppsSettings(s?.apps), payments: parsePaymentSettings(s?.payments) }
}

function viewOf(settings: EmiWidgetSettings, payments: ReturnType<typeof parsePaymentSettings>) {
  return {
    settings,
    readiness: emiReadiness(settings, payments),
    officialWidget: razorpayKeyIdOf(settings, payments) !== null,
    gatewaysOn: payments.enabled,
  } satisfies EmiSettingsView
}

export async function getEmiSettings(tx: StoreTx, storeId: string): Promise<EmiSettingsView> {
  const { apps, payments } = await loadRow(tx, storeId)
  return viewOf(parseEmiWidgetSettings(appSettingsOf(apps, EMI_PAY_LATER_ID)), payments)
}

/** Saved inside `store.apps` under the app's id; the install list and other apps are untouched. */
export async function saveEmiSettings(
  tx: StoreTx,
  storeId: string,
  input: EmiWidgetSettingsPatch,
): Promise<EmiSettingsView> {
  const { apps, payments } = await loadRow(tx, storeId, true)
  const current = parseEmiWidgetSettings(appSettingsOf(apps, EMI_PAY_LATER_ID))
  const next = applyEmiSettingsPatch(current, input)
  await tx
    .update(store)
    .set({ apps: withAppSettings(apps, EMI_PAY_LATER_ID, next) })
    .where(eq(store.id, storeId))
  return viewOf(next, payments)
}
