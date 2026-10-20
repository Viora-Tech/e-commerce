import { type AppJobQueue, encryptSecret, enqueueAppJob } from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { MeiliError } from '@commerce/plugin-meilisearch/client'
import {
  connectMeilisearch,
  indexStats,
  loadMeilisearchEntry,
  type MeiliEnv,
  pushIndexSettings,
  revokeSearchKey,
  updateMeilisearchEntry,
} from '@commerce/plugin-meilisearch/server'
import {
  MEILISEARCH_ID,
  type MeilisearchSettings,
  type MeilisearchSettingsPatch,
  type MeilisearchSettingsView,
  meilisearchSettingsView,
  normaliseMeilisearchHost,
  REINDEX_JOB,
} from '@commerce/plugin-meilisearch/settings'
import { ORPCError } from '@orpc/server'

/** The app page: the saved settings plus live numbers from Meilisearch when it answers. */
export type MeilisearchPageView = MeilisearchSettingsView & {
  /** Products in the live index, or null when Meilisearch did not answer (or is not set up). */
  documents: number | null
  /** Meilisearch is still applying writes. */
  indexing: boolean
  /** Meilisearch's words when the live numbers could not be read. */
  statsError: string | null
}

/** A "Reindex now" this old that never finished is treated as lost, so it can be asked again. */
const REINDEX_STALE_MS = 30 * 60_000

const badRequest = (message: string) => new ORPCError('BAD_REQUEST', { message })

/** Meilisearch's own words for a failed call, as the admin's error. */
function meiliFailure(err: unknown): never {
  if (err instanceof MeiliError) throw badRequest(err.message)
  throw err
}

export async function getMeilisearchPage(
  tx: StoreTx,
  storeId: string,
  env: MeiliEnv,
): Promise<MeilisearchPageView> {
  const { settings } = await loadMeilisearchEntry(tx, storeId)
  const view = meilisearchSettingsView(settings)
  try {
    const stats = await indexStats(settings, storeId, env)
    return {
      ...view,
      documents: stats?.documents ?? null,
      indexing: stats?.indexing ?? false,
      statsError: null,
    }
  } catch (err) {
    const statsError = err instanceof MeiliError ? err.message : 'Could not read Meilisearch.'
    return { ...view, documents: null, indexing: false, statsError }
  }
}

/**
 * Saves the form. A new address or admin key points at a different index, so shoppers go back
 * to the built-in search until the next reindex finishes there. New synonyms are sent to
 * Meilisearch straight away when it is connected.
 */
export async function saveMeilisearchSettings(
  tx: StoreTx,
  storeId: string,
  patch: MeilisearchSettingsPatch,
  env: MeiliEnv,
): Promise<MeilisearchSettingsView> {
  let host: string | undefined
  if (patch.host !== undefined && patch.host !== '') {
    const normalised = normaliseMeilisearchHost(patch.host)
    if (!normalised) throw badRequest('That does not look like a web address.')
    host = normalised
  } else if (patch.host === '') host = ''
  const { settings: before } = await loadMeilisearchEntry(tx, storeId)
  const moved =
    (host !== undefined && host !== before.host) ||
    (patch.adminKey !== undefined && patch.adminKey !== '')
  if (moved || patch.adminKey === '') await revokeSearchKey(before, env)
  const next = await updateMeilisearchEntry(tx, storeId, (s) => {
    const out: MeilisearchSettings = { ...s }
    if (host !== undefined) out.host = host
    if (patch.adminKey !== undefined) {
      out.adminKey = patch.adminKey === '' ? '' : encryptSecret(patch.adminKey, env.secret)
    }
    if (moved || patch.adminKey === '') {
      out.searchKey = ''
      out.searchKeyUid = ''
      out.lastSyncAt = null
      out.lastSyncCount = null
      out.lastError = null
    }
    if (patch.synonyms !== undefined) out.synonyms = patch.synonyms.filter((g) => g.length >= 2)
    return out
  })
  if (patch.synonyms !== undefined && !moved && next.lastSyncAt) {
    await pushIndexSettings(next, storeId, env).catch(meiliFailure)
  }
  return meilisearchSettingsView(next)
}

/** Checks the address and key, prepares the index and the search-only key. */
export async function testMeilisearch(
  tx: StoreTx,
  storeId: string,
  env: MeiliEnv,
): Promise<{ version: string; searchKey: boolean }> {
  const { settings } = await loadMeilisearchEntry(tx, storeId)
  if (!normaliseMeilisearchHost(settings.host))
    throw badRequest('Add your Meilisearch address first.')
  if (!settings.adminKey) throw badRequest('Add the Meilisearch admin key first.')
  return connectMeilisearch(tx, storeId, env).catch(meiliFailure)
}

/** Queues a full rebuild of the store's index; a second click while one waits is a no-op. */
export async function requestReindex(
  tx: StoreTx,
  storeId: string,
  appJobs: AppJobQueue,
  now = new Date(),
): Promise<MeilisearchSettingsView> {
  const { settings } = await loadMeilisearchEntry(tx, storeId)
  if (!normaliseMeilisearchHost(settings.host) || !settings.adminKey) {
    throw badRequest('Connect Meilisearch first.')
  }
  const pending = settings.reindexRequestedAt ? Date.parse(settings.reindexRequestedAt) : Number.NaN
  if (now.getTime() - pending < REINDEX_STALE_MS) return meilisearchSettingsView(settings)
  const next = await updateMeilisearchEntry(tx, storeId, (s) => ({
    ...s,
    reindexRequestedAt: now.toISOString(),
  }))
  await enqueueAppJob(
    appJobs,
    { storeId, pluginId: MEILISEARCH_ID, name: REINDEX_JOB, data: {} },
    // Keyed by the request: a lost or failed run never blocks the next "Reindex now".
    `reindex-${now.getTime()}`,
  )
  return meilisearchSettingsView(next)
}
