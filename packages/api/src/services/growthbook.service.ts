import {
  appSettingsOf,
  decryptSecret,
  encryptSecret,
  parseAppsSettings,
  withAppSettings,
} from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { store } from '@commerce/db'
import {
  GrowthbookError,
  type GrowthbookExperiment,
  growthbookClient,
  parseTrustedOrigins,
} from '@commerce/plugin-growthbook/client'
import {
  GROWTHBOOK_ID,
  type GrowthbookSettings,
  type GrowthbookSettingsPatch,
  type GrowthbookSettingsView,
  growthbookConnection,
  growthbookSettingsView,
  isClientKey,
  normaliseGrowthbookUrl,
  parseGrowthbookSettings,
} from '@commerce/plugin-growthbook/settings'
import { ORPCError } from '@orpc/server'
import { eq } from 'drizzle-orm'

/** The secrets and addresses the service needs from the environment. */
export type GrowthbookEnv = {
  secret: string
  /** `GROWTHBOOK_TRUSTED_ORIGINS`, raw. */
  trustedOrigins: string | undefined
}

/** What the app page's experiment list draws: a state, never a thrown error. */
export type GrowthbookExperimentsView =
  | { state: 'not-connected' }
  /** Shoppers are assigned, but no secret key is saved to list experiments with. */
  | { state: 'no-key' }
  | { state: 'error'; message: string }
  | { state: 'ready'; experiments: GrowthbookExperiment[] }

async function loadRow(tx: StoreTx, storeId: string, lock = false) {
  const read = tx.select({ apps: store.apps }).from(store).where(eq(store.id, storeId))
  const [s] = lock ? await read.for('update') : await read
  const apps = parseAppsSettings(s?.apps)
  return { apps, settings: parseGrowthbookSettings(appSettingsOf(apps, GROWTHBOOK_ID)) }
}

const badRequest = (message: string) => new ORPCError('BAD_REQUEST', { message })

function clientFor(settings: GrowthbookSettings, env: GrowthbookEnv) {
  const connection = growthbookConnection(settings)
  if (!connection) throw badRequest('Add your GrowthBook address and SDK client key first.')
  return {
    connection,
    client: growthbookClient({
      apiHost: connection.apiHost,
      trustedOrigins: parseTrustedOrigins(env.trustedOrigins),
    }),
  }
}

function secretOf(settings: GrowthbookSettings, env: GrowthbookEnv): string {
  try {
    return decryptSecret(settings.secretKey, env.secret)
  } catch {
    throw badRequest('The saved secret key can no longer be read. Paste it again.')
  }
}

/** GrowthBook's own words for a failed call, as the admin's error. */
function growthbookFailure(err: unknown): never {
  if (err instanceof GrowthbookError) throw badRequest(err.message)
  throw err
}

export async function getGrowthbookSettings(
  tx: StoreTx,
  storeId: string,
): Promise<GrowthbookSettingsView> {
  return growthbookSettingsView((await loadRow(tx, storeId)).settings)
}

/** Saves the form. Addresses are normalised, the client key checked, a new secret encrypted. */
export async function saveGrowthbookSettings(
  tx: StoreTx,
  storeId: string,
  patch: GrowthbookSettingsPatch,
  env: GrowthbookEnv,
): Promise<GrowthbookSettingsView> {
  const { apps, settings } = await loadRow(tx, storeId, true)
  const next: GrowthbookSettings = { ...settings }
  const address = (value: string) => {
    if (value === '') return ''
    const url = normaliseGrowthbookUrl(value)
    if (!url) throw badRequest('That does not look like a web address.')
    return url
  }
  if (patch.apiHost !== undefined) next.apiHost = address(patch.apiHost)
  if (patch.appUrl !== undefined) next.appUrl = address(patch.appUrl)
  if (patch.clientKey !== undefined) {
    if (patch.clientKey !== '' && !isClientKey(patch.clientKey)) {
      throw badRequest(
        'A client key starts with sdk-, for example sdk-AbC123xyz. Copy it from SDK Connections in GrowthBook.',
      )
    }
    next.clientKey = patch.clientKey
  }
  if (patch.decryptionKey !== undefined) next.decryptionKey = patch.decryptionKey
  if (patch.secretKey !== undefined) {
    next.secretKey = patch.secretKey === '' ? '' : encryptSecret(patch.secretKey, env.secret)
  }
  await tx
    .update(store)
    .set({ apps: withAppSettings(apps, GROWTHBOOK_ID, next) })
    .where(eq(store.id, storeId))
  return growthbookSettingsView(next)
}

/**
 * Reads the SDK connection's features (address and client key work) and, with a secret key, the
 * experiment list (the key works). Counts what it found.
 */
export async function testGrowthbook(
  tx: StoreTx,
  storeId: string,
  env: GrowthbookEnv,
): Promise<{ features: number; experiments: number | null }> {
  const { settings } = await loadRow(tx, storeId)
  const { connection, client } = clientFor(settings, env)
  const payload = await client.features(connection.clientKey).catch(growthbookFailure)
  const features =
    payload.features && typeof payload.features === 'object'
      ? Object.keys(payload.features).length
      : 0
  if (!settings.secretKey) return { features, experiments: null }
  const list = await client.experiments(secretOf(settings, env)).catch(growthbookFailure)
  return { features, experiments: list.length }
}

/** The experiments for the app page, newest running first; a drawable state whatever happens. */
export async function growthbookExperimentsFor(
  tx: StoreTx,
  storeId: string,
  env: GrowthbookEnv,
): Promise<GrowthbookExperimentsView> {
  const { settings } = await loadRow(tx, storeId)
  const view = growthbookSettingsView(settings)
  if (!view.assigning) return { state: 'not-connected' }
  if (!view.listing) return { state: 'no-key' }
  try {
    const { client } = clientFor(settings, env)
    const experiments = await client.experiments(secretOf(settings, env))
    return { state: 'ready', experiments: experiments.filter((e) => !e.archived) }
  } catch (err) {
    if (err instanceof GrowthbookError || err instanceof ORPCError) {
      return { state: 'error', message: err.message }
    }
    throw err
  }
}
