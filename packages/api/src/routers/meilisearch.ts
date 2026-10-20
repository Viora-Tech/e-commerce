import { loadEnv } from '@commerce/config'
import { permissions } from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { meiliEnv } from '@commerce/plugin-meilisearch/server'
import {
  MEILISEARCH_ID,
  MeilisearchSettingsPatchSchema,
} from '@commerce/plugin-meilisearch/settings'
import { ORPCError } from '@orpc/server'
import { can } from '../procedures'
import { getStoreApps } from '../services/apps.service'
import {
  getMeilisearchPage,
  requestReindex,
  saveMeilisearchSettings,
  testMeilisearch,
} from '../services/meilisearch.service'

type Ctx = { tx: StoreTx; scope: { storeId: string } }

function env() {
  const e = loadEnv(process.env)
  return meiliEnv(e.SETTINGS_SECRET, e.MEILISEARCH_TRUSTED_ORIGINS)
}

async function requireInstalled(context: Ctx) {
  const apps = await getStoreApps(context.tx, context.scope.storeId)
  if (!apps.installed.includes(MEILISEARCH_ID)) {
    throw new ORPCError('PRECONDITION_FAILED', { message: 'Install the Meilisearch app first' })
  }
}

/** The Meilisearch app's page: connection, index status, Reindex now and synonyms. */
export const meilisearchRouter = {
  get: can(permissions.SETTINGS_READ).handler(async ({ context }) => {
    await requireInstalled(context)
    return getMeilisearchPage(context.tx, context.scope.storeId, env())
  }),
  save: can(permissions.SETTINGS_MANAGE)
    .input(MeilisearchSettingsPatchSchema)
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      return saveMeilisearchSettings(context.tx, context.scope.storeId, input, env())
    }),
  /** Checks the address and admin key, then prepares the index and a search-only key. */
  test: can(permissions.SETTINGS_MANAGE).handler(async ({ context }) => {
    await requireInstalled(context)
    return testMeilisearch(context.tx, context.scope.storeId, env())
  }),
  /** Queues a full rebuild of the store's search index in the worker. */
  reindex: can(permissions.SETTINGS_MANAGE).handler(async ({ context }) => {
    await requireInstalled(context)
    if (!context.appJobs) {
      throw new ORPCError('INTERNAL_SERVER_ERROR', {
        message: 'Background jobs are not available here',
      })
    }
    return requestReindex(context.tx, context.scope.storeId, context.appJobs)
  }),
}
