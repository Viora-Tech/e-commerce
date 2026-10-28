/** SOURCE OF TRUTH: market service tests — WHAT: the primary market, countries in one market, subfolder and domain rules, delete or turn off, store isolation / WHY: the storefront routes by these rows */
import { createDb, market, marketRegion, order, store, storeDomain, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { StoreContext } from '../context'
import {
  createMarket,
  deleteMarket,
  ensurePrimaryMarket,
  getMarket,
  listMarkets,
  setMarketEnabled,
  updateMarket,
} from './service'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

beforeEach(async () => {
  await resetDb(owner)
})

async function newStore(slug: string) {
  const [s] = await owner.insert(store).values({ slug, name: slug }).returning()
  return s?.id as string
}

async function newDomain(
  storeId: string,
  hostname: string,
  fields: Partial<typeof storeDomain.$inferInsert> = {},
) {
  const [d] = await owner
    .insert(storeDomain)
    .values({ storeId, hostname, kind: 'custom', status: 'active', ...fields })
    .returning()
  return d?.id as string
}

const inStore = <T>(storeId: string, fn: (ctx: StoreContext) => Promise<T>) =>
  withStore(app, storeId, (tx) => fn({ storeId, tx }))

const gulf = { name: 'Gulf', countries: ['AE', 'SA'], currency: 'aed', subfolder: 'ae' }

describe('markets', () => {
  it('makes the primary market once: India, in the store’s currency, at the root', async () => {
    const storeId = await newStore('waimers')
    const first = await inStore(storeId, listMarkets)
    await inStore(storeId, (ctx) => ensurePrimaryMarket(ctx.tx, storeId))
    expect(await inStore(storeId, listMarkets)).toEqual(first)
    expect(first).toEqual([
      expect.objectContaining({
        name: 'India',
        handle: 'india',
        isPrimary: true,
        enabled: true,
        currency: 'INR',
        subfolder: null,
        countries: ['IN'],
      }),
    ])
  })

  it('adds a market with its countries, A to Z, and the primary market first', async () => {
    const storeId = await newStore('waimers')
    const made = await inStore(storeId, (ctx) =>
      createMarket(ctx, { ...gulf, countries: ['SA', 'AE', 'AE'], locales: ['ar', 'en'] }),
    )
    expect(made).toMatchObject({
      handle: 'gulf',
      currency: 'AED',
      locale: 'en',
      locales: ['ar'],
      subfolder: 'ae',
      countries: ['AE', 'SA'],
      rounding: 'none',
      duties: 'dap',
    })
    const again = await inStore(storeId, (ctx) =>
      createMarket(ctx, { name: 'Gulf', countries: ['QA'], currency: 'QAR' }),
    )
    expect(again.handle).toBe('gulf-2')
    expect((await inStore(storeId, listMarkets)).map((m) => m.name)).toEqual([
      'India',
      'Gulf',
      'Gulf',
    ])
  })

  it('keeps a country in one market and names the market that has it', async () => {
    const storeId = await newStore('waimers')
    await inStore(storeId, (ctx) => createMarket(ctx, gulf))
    await expect(
      inStore(storeId, (ctx) =>
        createMarket(ctx, { name: 'Middle East', countries: ['SA', 'QA'], currency: 'SAR' }),
      ),
    ).rejects.toThrow('Saudi Arabia is already in the Gulf market')
    await expect(
      inStore(storeId, (ctx) =>
        createMarket(ctx, { name: 'Home', countries: ['IN'], currency: 'USD' }),
      ),
    ).rejects.toThrow('India is already in the India market')
    await expect(
      inStore(storeId, (ctx) =>
        createMarket(ctx, { name: 'Nowhere', countries: ['XX'], currency: 'USD' }),
      ),
    ).rejects.toThrow('XX is not a country code')
    await expect(
      inStore(storeId, (ctx) =>
        createMarket(ctx, { name: 'Empty', countries: [], currency: 'USD' }),
      ),
    ).rejects.toThrow('Add at least one country')
    await expect(
      inStore(storeId, (ctx) =>
        createMarket(ctx, { name: 'Odd', countries: ['US'], currency: 'ZZZ' }),
      ),
    ).rejects.toThrow('ZZZ is not a currency code')
  })

  it('refuses a subfolder that is malformed, taken, or another market’s language address', async () => {
    const storeId = await newStore('waimers')
    await inStore(storeId, (ctx) => createMarket(ctx, { ...gulf, locales: ['ar'] }))
    const usa = { name: 'USA', countries: ['US'], currency: 'USD' }
    await expect(
      inStore(storeId, (ctx) => createMarket(ctx, { ...usa, subfolder: 'usa' })),
    ).rejects.toThrow('A subfolder is two letters')
    await expect(
      inStore(storeId, (ctx) => createMarket(ctx, { ...usa, subfolder: 'AE' })),
    ).rejects.toThrow('/ae already opens the Gulf market')
    await expect(
      inStore(storeId, (ctx) => createMarket(ctx, { ...usa, subfolder: 'ar-ae' })),
    ).rejects.toThrow('/ar-ae already opens the Gulf market')
    // The primary market answers on /hi once Hindi is one of its languages.
    const [india] = await inStore(storeId, listMarkets)
    await inStore(storeId, (ctx) => updateMarket(ctx, { id: india?.id as string, locales: ['hi'] }))
    await expect(
      inStore(storeId, (ctx) => createMarket(ctx, { ...usa, subfolder: 'hi' })),
    ).rejects.toThrow('/hi already opens the India market')
    const ok = await inStore(storeId, (ctx) => createMarket(ctx, { ...usa, subfolder: 'en-us' }))
    expect(ok.subfolder).toBe('en-us')
  })

  it('opens a market on one of the store’s own live domains only', async () => {
    const storeId = await newStore('waimers')
    const other = await newStore('other')
    const ae = await newDomain(storeId, 'waimers.ae')
    const main = await newDomain(storeId, 'waimers.in', { isPrimary: true })
    const redirect = await newDomain(storeId, 'www.waimers.ae', { redirectToPrimary: true })
    const pending = await newDomain(storeId, 'waimers.us', { status: 'pending' })
    const theirs = await newDomain(other, 'other.ae')
    const viaDomain = (storeDomainId: string) =>
      inStore(storeId, (ctx) => createMarket(ctx, { ...gulf, subfolder: null, storeDomainId }))

    await expect(viaDomain(theirs)).rejects.toThrow('Pick one of your own domains')
    await expect(viaDomain(main)).rejects.toThrow('is your main domain')
    await expect(viaDomain(redirect)).rejects.toThrow('sends shoppers to your main domain')
    await expect(viaDomain(pending)).rejects.toThrow('is not connected yet')
    await expect(
      inStore(storeId, (ctx) => createMarket(ctx, { ...gulf, storeDomainId: ae })),
    ).rejects.toThrow('Pick one way in')

    const made = await viaDomain(ae)
    expect(made).toMatchObject({ storeDomainId: ae, hostname: 'waimers.ae', subfolder: null })
    await expect(
      inStore(storeId, (ctx) =>
        createMarket(ctx, { name: 'Qatar', countries: ['QA'], currency: 'QAR', storeDomainId: ae }),
      ),
    ).rejects.toThrow('waimers.ae already opens the Gulf market')

    // A domain that stops resolving later does not block other changes to its market.
    await owner.update(storeDomain).set({ status: 'failed' }).where(eq(storeDomain.id, ae))
    const renamed = await inStore(storeId, (ctx) =>
      updateMarket(ctx, { id: made.id, name: 'Gulf states' }),
    )
    expect(renamed).toMatchObject({ name: 'Gulf states', storeDomainId: ae })
  })

  it('keeps the primary market whole: no subfolder, same country and currency, always on', async () => {
    const storeId = await newStore('waimers')
    const [india] = await inStore(storeId, listMarkets)
    const id = india?.id as string
    await expect(
      inStore(storeId, (ctx) => updateMarket(ctx, { id, currency: 'USD' })),
    ).rejects.toThrow('Only its name and languages change')
    await expect(
      inStore(storeId, (ctx) => updateMarket(ctx, { id, countries: ['IN', 'NP'] })),
    ).rejects.toThrow('Only its name and languages change')
    await expect(
      inStore(storeId, (ctx) => updateMarket(ctx, { id, subfolder: 'in' })),
    ).rejects.toThrow('not a subfolder')
    await expect(
      inStore(storeId, (ctx) => setMarketEnabled(ctx, { id, enabled: false })),
    ).rejects.toThrow('always on')
    await expect(inStore(storeId, (ctx) => deleteMarket(ctx, { id }))).rejects.toThrow(
      "can't be deleted",
    )
    const renamed = await inStore(storeId, (ctx) =>
      updateMarket(ctx, { id, name: 'Bharat', locale: 'hi', locales: ['en', 'hi'] }),
    )
    expect(renamed).toMatchObject({
      name: 'Bharat',
      locale: 'hi',
      locales: ['en'],
      countries: ['IN'],
    })
  })

  it('moves countries between markets and changes the rest in place', async () => {
    const storeId = await newStore('waimers')
    const g = await inStore(storeId, (ctx) => createMarket(ctx, gulf))
    const changed = await inStore(storeId, (ctx) =>
      updateMarket(ctx, {
        id: g.id,
        countries: ['AE', 'QA'],
        priceAdjustmentBp: 1000,
        rounding: 'x99',
        manualRate: '0.044',
        duties: 'ddp',
      }),
    )
    expect(changed).toMatchObject({
      countries: ['AE', 'QA'],
      priceAdjustmentBp: 1000,
      rounding: 'x99',
      duties: 'ddp',
      subfolder: 'ae',
    })
    expect(Number(changed.manualRate)).toBe(0.044)
    // Saudi Arabia left the Gulf, so another market may take it.
    const saudi = await inStore(storeId, (ctx) =>
      createMarket(ctx, {
        name: 'Saudi Arabia',
        countries: ['SA'],
        currency: 'SAR',
        subfolder: 'sa',
      }),
    )
    expect(saudi.countries).toEqual(['SA'])
    const off = await inStore(storeId, (ctx) => setMarketEnabled(ctx, { id: g.id, enabled: false }))
    expect(off.enabled).toBe(false)
    expect((await inStore(storeId, (ctx) => getMarket(ctx, g.id))).enabled).toBe(false)
  })

  it('deletes a market without orders, and turns off one with orders', async () => {
    const storeId = await newStore('waimers')
    const g = await inStore(storeId, (ctx) => createMarket(ctx, gulf))
    const usa = await inStore(storeId, (ctx) =>
      createMarket(ctx, { name: 'USA', countries: ['US'], currency: 'USD', subfolder: 'us' }),
    )
    await owner
      .insert(order)
      .values({ storeId, number: 1001, subtotalPaise: 1000, totalPaise: 1000, marketId: g.id })

    expect(await inStore(storeId, (ctx) => deleteMarket(ctx, { id: usa.id }))).toEqual({
      outcome: 'deleted',
    })
    expect(
      await owner.select().from(marketRegion).where(eq(marketRegion.marketId, usa.id)),
    ).toEqual([])
    expect(await inStore(storeId, (ctx) => deleteMarket(ctx, { id: g.id }))).toEqual({
      outcome: 'disabled',
    })
    const [kept] = await owner.select().from(market).where(eq(market.id, g.id))
    expect(kept?.enabled).toBe(false)
  })

  it('never reaches another store’s markets', async () => {
    const a = await newStore('store-a')
    const b = await newStore('store-b')
    const g = await inStore(a, (ctx) => createMarket(ctx, gulf))
    // The same country and subfolder are free in another store.
    await inStore(b, (ctx) => createMarket(ctx, gulf))
    await expect(inStore(b, (ctx) => getMarket(ctx, g.id))).rejects.toThrow('Market not found')
    await expect(
      inStore(b, (ctx) => updateMarket(ctx, { id: g.id, name: 'Mine' })),
    ).rejects.toThrow('Market not found')
    await expect(inStore(b, (ctx) => deleteMarket(ctx, { id: g.id }))).rejects.toThrow(
      'Market not found',
    )
    expect((await inStore(a, (ctx) => getMarket(ctx, g.id))).name).toBe('Gulf')
  })
})
