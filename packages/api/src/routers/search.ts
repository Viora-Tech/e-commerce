import {
  BOOST_ACTIONS,
  BOOST_FIELDS,
  discoveryOverview,
  filterSources,
  getFilterConfig,
  getProductRecommendations,
  getSearchSynonyms,
  listSearchBoostRules,
  listSearchPins,
  MAX_BOOST_RULES,
  MAX_BOOST_VALUE,
  MAX_PICKED_RECOMMENDATIONS,
  MAX_PINS_PER_TERM,
  MAX_QUERY_LENGTH,
  OVERVIEW_PERIODS,
  permissions,
  productsWithPicks,
  RECOMMENDATION_INTENTS,
  recommendationTarget,
  SearchPinLimitError,
  StorefrontFilterConfigSchema,
  SynonymGroupsSchema,
  setFilterConfig,
  setProductRecommendations,
  setSearchBoostRules,
  setSearchPins,
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

const BoostRuleSchema = z.object({
  field: z.enum(BOOST_FIELDS),
  value: z.string().trim().min(1).max(MAX_BOOST_VALUE),
  action: z.enum(BOOST_ACTIONS),
})

/**
 * The Search & discovery app: the built-in search's synonym groups, the storefront filters, the
 * Overview (search funnel, top and failing searches, recommendation numbers), search boosts and
 * pins, and the merchant's picked recommendations.
 */
export const searchRouter = {
  overview: can(permissions.ONLINE_STORE_READ)
    .input(
      z.object({
        days: z
          .number()
          .int()
          .refine((d) => (OVERVIEW_PERIODS as readonly number[]).includes(d))
          .default(30),
      }),
    )
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      return discoveryOverview(context.tx, input.days)
    }),
  boosts: {
    get: can(permissions.ONLINE_STORE_READ).handler(async ({ context }) => {
      await requireInstalled(context)
      const [rules, pins] = [
        await listSearchBoostRules(context.tx),
        await listSearchPins(context.tx),
      ]
      return { rules, pins }
    }),
    setRules: can(permissions.ONLINE_STORE_WRITE)
      .input(z.object({ rules: z.array(BoostRuleSchema).max(MAX_BOOST_RULES) }))
      .handler(async ({ context, input }) => {
        await requireInstalled(context)
        return setSearchBoostRules(context.tx, context.scope.storeId, input.rules)
      }),
    /** Pins products (in order) for one search; an empty list removes the search's pins. */
    setPins: can(permissions.ONLINE_STORE_WRITE)
      .input(
        z.object({
          term: z.string().trim().min(1).max(MAX_QUERY_LENGTH),
          productIds: z.array(z.uuid()).max(MAX_PINS_PER_TERM),
        }),
      )
      .handler(async ({ context, input }) => {
        await requireInstalled(context)
        try {
          return await setSearchPins(context.tx, context.scope.storeId, input.term, input.productIds)
        } catch (err) {
          if (err instanceof SearchPinLimitError) {
            throw new ORPCError('BAD_REQUEST', { message: err.message })
          }
          throw err
        }
      }),
  },
  recommendations: {
    /** Products with picks, for the Recommendations page's list. */
    list: can(permissions.PRODUCTS_READ).handler(async ({ context }) => {
      await requireInstalled(context)
      return productsWithPicks(context.tx)
    }),
    get: can(permissions.PRODUCTS_READ)
      .input(z.object({ productId: z.uuid() }))
      .handler(async ({ context, input }) => {
        await requireInstalled(context)
        const product = await recommendationTarget(context.tx, input.productId)
        if (!product) return null
        return { product, picks: await getProductRecommendations(context.tx, input.productId) }
      }),
    set: can(permissions.PRODUCTS_WRITE)
      .input(
        z.object({
          productId: z.uuid(),
          intent: z.enum(RECOMMENDATION_INTENTS),
          productIds: z.array(z.uuid()).max(MAX_PICKED_RECOMMENDATIONS),
        }),
      )
      .handler(async ({ context, input }) => {
        await requireInstalled(context)
        return setProductRecommendations(
          context.tx,
          context.scope.storeId,
          input.productId,
          input.intent,
          input.productIds,
        )
      }),
  },
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
