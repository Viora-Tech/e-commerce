import {
  createMarket,
  deleteMarket,
  getMarket,
  listMarkets,
  MarketCreateSchema,
  MarketEnabledSchema,
  MarketError,
  MarketIdSchema,
  MarketUpdateSchema,
  permissions,
  setMarketEnabled,
  updateMarket,
} from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { ORPCError } from '@orpc/server'
import { can } from '../procedures'

type Ctx = { scope: { storeId: string }; tx: StoreTx }
const ctxOf = (context: Ctx) => ({ storeId: context.scope.storeId, tx: context.tx })

const STATUS: Record<string, 'NOT_FOUND' | 'CONFLICT' | 'BAD_REQUEST'> = {
  MARKET_NOT_FOUND: 'NOT_FOUND',
  MARKET_CONFLICT: 'CONFLICT',
  MARKET_INVALID: 'BAD_REQUEST',
}

/** A refused market change as its HTTP error, keeping the words the admin shows. */
async function marketErrors<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (err instanceof MarketError) {
      throw new ORPCError(STATUS[err.code] ?? 'BAD_REQUEST', { message: err.message })
    }
    throw err
  }
}

const read = () => can(permissions.SETTINGS_READ)
const manage = () => can(permissions.SETTINGS_MANAGE)

/** Settings → Markets: the countries the store sells to, each with its currency, languages and way in. */
export const marketsRouter = {
  /** Every market with its countries, the primary market (India) first. */
  list: read().handler(({ context }) => listMarkets(ctxOf(context))),

  /** One market with its countries. */
  get: read()
    .input(MarketIdSchema)
    .handler(({ context, input }) => marketErrors(() => getMarket(ctxOf(context), input.id))),

  /** Add a market: its countries, currency, languages, prices and how shoppers reach it. */
  create: manage()
    .input(MarketCreateSchema)
    .handler(({ context, input }) => marketErrors(() => createMarket(ctxOf(context), input))),

  /** Change a market; the primary market only changes its name and languages. */
  update: manage()
    .input(MarketUpdateSchema)
    .handler(({ context, input }) => marketErrors(() => updateMarket(ctxOf(context), input))),

  /** Turn a market on or off for shoppers; the primary market is always on. */
  setEnabled: manage()
    .input(MarketEnabledSchema)
    .handler(({ context, input }) => marketErrors(() => setMarketEnabled(ctxOf(context), input))),

  /** Delete a market; one with orders is turned off instead, so its orders keep it. */
  delete: manage()
    .input(MarketIdSchema)
    .handler(({ context, input }) => marketErrors(() => deleteMarket(ctxOf(context), input))),
}
