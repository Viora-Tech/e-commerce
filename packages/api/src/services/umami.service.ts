import {
  appSettingsOf,
  decryptSecret,
  encryptSecret,
  parseAppsSettings,
  recordAppActivity,
  storefrontOriginFor,
  withAppSettings,
} from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { store } from '@commerce/db'
import { parseTrustedOrigins, UmamiError, umamiClient } from '@commerce/plugin-umami/client'
import type { UmamiReport } from '@commerce/plugin-umami/report'
import {
  isUmamiCloud,
  isWebsiteId,
  normaliseUmamiUrl,
  parseUmamiSettings,
  UMAMI_ID,
  type UmamiSettings,
  type UmamiSettingsPatch,
  type UmamiSettingsView,
  umamiSettingsView,
} from '@commerce/plugin-umami/settings'
import { ORPCError } from '@orpc/server'
import { eq } from 'drizzle-orm'
import { type RangeInput, resolveRange } from './analytics-buckets'

/** The secrets and addresses the service needs from the environment. */
export type UmamiEnv = {
  secret: string
  /** `UMAMI_TRUSTED_ORIGINS`, raw. */
  trustedOrigins: string | undefined
  /** `STOREFRONT_URL`, the fallback when the store has no live domain yet. */
  storefrontUrl: string
}

/** What the Analytics page's visitor section draws. */
export type UmamiReportView =
  | { state: 'not-installed' }
  /** Installed, but no address, website or API key yet. */
  | { state: 'not-connected'; tracking: boolean }
  | { state: 'error'; message: string }
  | {
      state: 'ready'
      range: { key: string; from: string; to: string; days: string[] }
      report: UmamiReport
      /** The website's page in Umami, for "Open in Umami". */
      dashboardUrl: string
    }

/** Days are Indian Standard Time across the analytics section. */
const TIMEZONE = 'Asia/Kolkata'

async function loadRow(tx: StoreTx, storeId: string) {
  const [s] = await tx
    .select({ apps: store.apps, name: store.name })
    .from(store)
    .where(eq(store.id, storeId))
  const apps = parseAppsSettings(s?.apps)
  return {
    apps,
    name: s?.name ?? '',
    installed: apps.installed.includes(UMAMI_ID),
    settings: parseUmamiSettings(appSettingsOf(apps, UMAMI_ID)),
  }
}

async function write(
  tx: StoreTx,
  storeId: string,
  apps: ReturnType<typeof parseAppsSettings>,
  next: UmamiSettings,
) {
  await tx
    .update(store)
    .set({ apps: withAppSettings(apps, UMAMI_ID, next) })
    .where(eq(store.id, storeId))
}

const badRequest = (message: string) => new ORPCError('BAD_REQUEST', { message })

/** An API client for the saved settings, or a plain-words error when something is missing. */
function clientFor(settings: UmamiSettings, env: UmamiEnv) {
  const url = normaliseUmamiUrl(settings.url)
  if (!url) throw badRequest('Add your Umami address first.')
  if (!settings.apiKey) throw badRequest('Add an Umami API key first.')
  let apiKey: string
  try {
    apiKey = decryptSecret(settings.apiKey, env.secret)
  } catch {
    throw badRequest('The saved API key can no longer be read. Paste it again.')
  }
  return umamiClient({ url, apiKey, trustedOrigins: parseTrustedOrigins(env.trustedOrigins) })
}

/** Umami's own words for a failed call, as the admin's error. */
function umamiFailure(err: unknown): never {
  if (err instanceof UmamiError) throw badRequest(err.message)
  throw err
}

export async function getUmamiSettings(tx: StoreTx, storeId: string): Promise<UmamiSettingsView> {
  return umamiSettingsView((await loadRow(tx, storeId)).settings)
}

/** Saves the form. The address is normalised, the website id checked, a new key encrypted. */
export async function saveUmamiSettings(
  tx: StoreTx,
  storeId: string,
  patch: UmamiSettingsPatch,
  env: UmamiEnv,
): Promise<UmamiSettingsView> {
  const { apps, settings } = await loadRow(tx, storeId)
  const next: UmamiSettings = { ...settings }
  if (patch.url !== undefined) {
    if (patch.url === '') next.url = ''
    else {
      const url = normaliseUmamiUrl(patch.url)
      if (!url) throw badRequest('That does not look like a web address.')
      next.url = url
    }
  }
  if (patch.websiteId !== undefined) {
    if (patch.websiteId !== '' && !isWebsiteId(patch.websiteId)) {
      throw badRequest(
        'A website id looks like 4f1e2a7c-9b3d-4c5e-8f60-1a2b3c4d5e6f. Copy it from Umami.',
      )
    }
    next.websiteId = patch.websiteId.toLowerCase()
  }
  if (patch.apiKey !== undefined) {
    next.apiKey = patch.apiKey === '' ? '' : encryptSecret(patch.apiKey, env.secret)
  }
  if (patch.waitForConsent !== undefined) next.waitForConsent = patch.waitForConsent
  await write(tx, storeId, apps, next)
  return umamiSettingsView(next)
}

/** Reads the website with the saved key: proves the address, the key and the id together. */
export async function testUmami(
  tx: StoreTx,
  storeId: string,
  env: UmamiEnv,
): Promise<{ name: string; domain: string }> {
  const { settings } = await loadRow(tx, storeId)
  if (!isWebsiteId(settings.websiteId)) throw badRequest('Add the Umami website id first.')
  const website = await clientFor(settings, env).website(settings.websiteId).catch(umamiFailure)
  await recordAppActivity(tx, storeId, UMAMI_ID, `Connected to ${website.name}`, {
    clearError: true,
  })
  return { name: website.name, domain: website.domain }
}

/** Creates a website named after the store in the key owner's Umami and saves its id. */
export async function createUmamiWebsite(
  tx: StoreTx,
  storeId: string,
  env: UmamiEnv,
): Promise<UmamiSettingsView> {
  const { apps, name, settings } = await loadRow(tx, storeId)
  const origin = await storefrontOriginFor(tx, storeId, env.storefrontUrl)
  const created = await clientFor(settings, env)
    .createWebsite({ name: name || new URL(origin).hostname, domain: new URL(origin).hostname })
    .catch(umamiFailure)
  const next = { ...settings, websiteId: created.id.toLowerCase() }
  await write(tx, storeId, apps, next)
  return umamiSettingsView(next)
}

/** The website's page in the Umami dashboard. */
function dashboardUrl(settings: UmamiSettings): string {
  const url = normaliseUmamiUrl(settings.url) ?? settings.url
  const root = isUmamiCloud(url) ? 'https://cloud.umami.is' : url
  return `${root}/websites/${settings.websiteId}`
}

/**
 * The visitor section for one range: a state the page can draw whatever happens (not
 * installed, not connected, Umami unreachable), never a thrown error, so the rest of the
 * Analytics page is unaffected.
 */
export async function umamiReportFor(
  tx: StoreTx,
  storeId: string,
  input: RangeInput,
  env: UmamiEnv,
  now = new Date(),
): Promise<UmamiReportView> {
  const { installed, settings } = await loadRow(tx, storeId)
  if (!installed) return { state: 'not-installed' }
  const view = umamiSettingsView(settings)
  if (!view.reporting) return { state: 'not-connected', tracking: view.tracking }
  const range = resolveRange(input, now)
  try {
    const report = await clientFor(settings, env).report(
      settings.websiteId,
      { startAt: range.from.getTime(), endAt: range.to.getTime() - 1, days: range.days },
      TIMEZONE,
    )
    // Reading visits is this app's use: the Installed apps list shows it as last activity.
    await recordAppActivity(tx, storeId, UMAMI_ID, 'Read visits for Analytics', {
      clearError: true,
      now,
    })
    return {
      state: 'ready',
      range: {
        key: range.key,
        from: range.days[0] ?? '',
        to: range.days.at(-1) ?? '',
        days: range.days,
      },
      report,
      dashboardUrl: dashboardUrl(settings),
    }
  } catch (err) {
    if (err instanceof UmamiError) return { state: 'error', message: err.message }
    if (err instanceof ORPCError) return { state: 'error', message: err.message }
    throw err
  }
}
