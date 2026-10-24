/** SOURCE OF TRUTH: inboxState, saveInboxSettings — WHAT: whether a store installed Inbox, its parsed settings and its time zone, read from `store.apps` in one query; and saving a settings patch / WHY: every Inbox entry point (admin API, widget, stream) starts with "is it installed and how is it set" (design §3). */
import { type StoreTx, store } from '@commerce/db'
import { eq } from 'drizzle-orm'
import { appSettingsOf, parseAppsSettings, withAppSettings } from '../apps/settings'
import { INBOX_APP_ID } from './constants'
import { type InboxSettings, type InboxSettingsPatch, parseInboxSettings } from './settings'

export type InboxState = {
  installed: boolean
  settings: InboxSettings
  timeZone: string
  storeName: string
}

export async function inboxState(tx: StoreTx, storeId: string): Promise<InboxState> {
  const [s] = await tx
    .select({ apps: store.apps, timezone: store.timezone, name: store.name })
    .from(store)
    .where(eq(store.id, storeId))
  const apps = parseAppsSettings(s?.apps)
  return {
    installed: apps.installed.includes(INBOX_APP_ID),
    settings: parseInboxSettings(appSettingsOf(apps, INBOX_APP_ID)),
    timeZone: s?.timezone ?? 'Asia/Kolkata',
    storeName: s?.name ?? '',
  }
}

/** Merges `patch` into the saved settings and returns the result. */
export async function saveInboxSettings(
  tx: StoreTx,
  storeId: string,
  patch: InboxSettingsPatch,
): Promise<InboxSettings> {
  const [s] = await tx.select({ apps: store.apps }).from(store).where(eq(store.id, storeId))
  const apps = parseAppsSettings(s?.apps)
  const next = parseInboxSettings({
    ...parseInboxSettings(appSettingsOf(apps, INBOX_APP_ID)),
    ...patch,
  })
  await tx
    .update(store)
    .set({ apps: withAppSettings(apps, INBOX_APP_ID, next) })
    .where(eq(store.id, storeId))
  return next
}
