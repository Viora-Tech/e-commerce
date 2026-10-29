import {
  filterSources,
  getFilterConfig,
  getSearchSynonyms,
  permissions,
  StorefrontFilterConfigSchema,
  SynonymGroupsSchema,
  setFilterConfig,
  setSearchSynonyms,
} from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { SEARCH_ID } from '@commerce/plugin-search'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { can } from '../procedures'
import { getStoreApps } from '../services/apps.service'

type Ctx = { tx: StoreTx; scope: { storeId: string } }

async function requireInstalled(context: Ctx) {
  const apps = await getStoreApps(context.tx, context.scope.storeId)
  if (!apps.installed.includes(SEARCH_ID)) {
    throw new ORPCError('PRECONDITION_FAILED', {
      message: 'Install the Search & discovery app first',
    })
  }
}

/** The Search & discovery app: the built-in search's synonym groups and the storefront filters. */
export const searchRouter = {
  synonyms: {
    get: can(permissions.ONLINE_STORE_READ).handler(async ({ context }) => {
      await requireInstalled(context)
      return getSearchSynonyms(context.tx, context.scope.storeId)
    }),
    set: can(permissions.ONLINE_STORE_WRITE)
      .input(z.object({ groups: SynonymGroupsSchema }))
      .handler(async ({ context, input }) => {
        await requireInstalled(context)
        return setSearchSynonyms(context.tx, context.scope.storeId, input.groups)
      }),
  },
  filters: {
    /** The store's filter settings (null: the default filters) and what it can filter by. */
    get: can(permissions.ONLINE_STORE_READ).handler(async ({ context }) => {
      await requireInstalled(context)
      const config = await getFilterConfig(context.tx, context.scope.storeId)
      const sources = await filterSources(context.tx)
      return { config, sources }
    }),
    set: can(permissions.ONLINE_STORE_WRITE)
      .input(z.object({ config: StorefrontFilterConfigSchema.nullable() }))
      .handler(async ({ context, input }) => {
        await requireInstalled(context)
        return setFilterConfig(context.tx, context.scope.storeId, input.config)
      }),
  },
}
