/** SOURCE OF TRUTH: listMarkets, getMarket, createMarket, updateMarket, setMarketEnabled,
 *   deleteMarket, ensurePrimaryMarket, MarketError
 * WHAT:  Settings → Markets: the store's markets with their countries, currency, languages,
 *        prices and way in (a subfolder, the market's own domain, or the shopper's choice),
 *        Shopify Markets style. Checks what the database cannot: a country sits in one market
 *        only (the error names it), no subfolder answers for another market's language, a
 *        market's domain is one of the store's own live ones, and the primary market stays whole.
 * WHY:   The storefront proxy routes `/<subfolder>/…` and a market's domain from these rows
 *        (`store_markets`), so two markets must never claim the same address.
 * WHERE: `markets.*` (api), Settings → Markets (admin), createStore (the primary market).
 */
import {
  isUniqueViolation,
  MARKET_DUTIES,
  MARKET_ROUNDING,
  type MarketDuties,
  type MarketRounding,
  market,
  marketRegion,
  order,
  type StoreTx,
  store,
  storeDomain,
} from '@commerce/db'
import { and, asc, desc, eq, inArray, like, or } from 'drizzle-orm'
import { z } from 'zod'
import { slugify } from '../catalog/slug'
import type { StoreContext } from '../context'
import { CommerceError } from '../errors'
import {
  COUNTRY_CODES,
  isCountryCode,
  isMarketLanguage,
  MARKET_LANGUAGES,
  pathClash,
  SUBFOLDER_PATTERN,
} from './client'

type MarketRow = typeof market.$inferSelect

/** A market as the admin shows it: the row, its countries (A–Z) and its own domain's hostname. */
export type MarketView = Omit<MarketRow, 'storeId' | 'createdAt' | 'updatedAt'> & {
  countries: string[]
  hostname: string | null
}

/** Why a market change was refused, in words the merchant can act on; `code` picks the status. */
export class MarketError extends CommerceError {
  constructor(
    code: 'MARKET_NOT_FOUND' | 'MARKET_INVALID' | 'MARKET_CONFLICT',
    message: string,
    storeId?: string,
  ) {
    super(code, message, { storeId })
  }
}

const NameSchema = z.string().trim().min(1, 'Give the market a name').max(80)
const CountriesSchema = z.array(z.string().trim().toUpperCase()).max(COUNTRY_CODES.length)
const CurrencySchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, 'Use a three-letter currency code, like AED')
const LanguageSchema = z
  .string()
  .trim()
  .toLowerCase()
  .refine(isMarketLanguage, 'Pick one of the offered languages')
const LanguagesSchema = z.array(LanguageSchema).max(MARKET_LANGUAGES.length)
/** An empty subfolder is none. */
const SubfolderSchema = z.string().trim().toLowerCase().max(5).nullable()
/** Basis points: 1000 is 10% above the converted price (`market_adjustment`). */
const AdjustmentSchema = z.number().int().min(-5000).max(20000)
/** "1 INR = 0.044 AED": presentment units per rupee, `numeric(18, 8)`. Null: the daily rate. */
const RateSchema = z
  .string()
  .trim()
  .regex(/^\d{1,10}(\.\d{1,8})?$/, 'Type the rate as a number, like 0.044')
  .refine((v) => Number(v) > 0, 'The rate must be more than zero')
  .nullable()

export const MarketCreateSchema = z.object({
  name: NameSchema,
  countries: CountriesSchema,
  currency: CurrencySchema,
  locale: LanguageSchema.default('en'),
  locales: LanguagesSchema.default([]),
  subfolder: SubfolderSchema.default(null),
  storeDomainId: z.uuid().nullable().default(null),
  priceAdjustmentBp: AdjustmentSchema.default(0),
  rounding: z.enum(MARKET_ROUNDING).default('none'),
  manualRate: RateSchema.default(null),
  duties: z.enum(MARKET_DUTIES).default('dap'),
})

/** Only the fields sent change; the primary market only takes a name and languages. */
export const MarketUpdateSchema = z.object({
  id: z.uuid(),
  name: NameSchema.optional(),
  countries: CountriesSchema.optional(),
  currency: CurrencySchema.optional(),
  locale: LanguageSchema.optional(),
  locales: LanguagesSchema.optional(),
  subfolder: SubfolderSchema.optional(),
  storeDomainId: z.uuid().nullable().optional(),
  priceAdjustmentBp: AdjustmentSchema.optional(),
  rounding: z.enum(MARKET_ROUNDING).optional(),
  manualRate: RateSchema.optional(),
  duties: z.enum(MARKET_DUTIES).optional(),
})

export const MarketIdSchema = z.object({ id: z.uuid() })
export const MarketEnabledSchema = z.object({ id: z.uuid(), enabled: z.boolean() })

/** Everything a market is made of besides its id, handle and switch. */
type Draft = {
  name: string
  countries: string[]
  currency: string
  locale: string
  locales: string[]
  subfolder: string | null
  storeDomainId: string | null
  priceAdjustmentBp: number
  rounding: MarketRounding
  manualRate: string | null
  duties: MarketDuties
}

// Built on first use, not when core loads: most callers of the barrel never need them.
let currencies: Set<string> | null = null
let regionNames: Intl.DisplayNames | null = null

function isCurrency(code: string): boolean {
  currencies ??= new Set(Intl.supportedValuesOf('currency'))
  return currencies.has(code)
}

function countryName(code: string): string {
  regionNames ??= new Intl.DisplayNames(['en'], { type: 'region' })
  return regionNames.of(code) ?? code
}

/** Countries once each, extra languages without the default, an empty subfolder as none. */
function normalise(d: Draft): Draft {
  return {
    ...d,
    countries: [...new Set(d.countries)],
    locales: [...new Set(d.locales)].filter((l) => l !== d.locale),
    subfolder: d.subfolder || null,
  }
}

function draftOf(v: MarketView): Draft {
  return {
    name: v.name,
    countries: v.countries,
    currency: v.currency,
    locale: v.locale,
    locales: v.locales,
    subfolder: v.subfolder,
    storeDomainId: v.storeDomainId,
    priceAdjustmentBp: v.priceAdjustmentBp,
    rounding: v.rounding,
    manualRate: v.manualRate,
    duties: v.duties,
  }
}

/** The market's columns from a draft (its countries are rows of their own). */
function columnsOf(d: Draft) {
  const { countries: _countries, ...columns } = d
  return columns
}

async function views(tx: StoreTx, id?: string): Promise<MarketView[]> {
  const rows = await tx
    .select({ m: market, hostname: storeDomain.hostname })
    .from(market)
    .leftJoin(storeDomain, eq(storeDomain.id, market.storeDomainId))
    .where(id ? eq(market.id, id) : undefined)
    .orderBy(desc(market.isPrimary), asc(market.name), asc(market.id))
  if (rows.length === 0) return []
  const regions = await tx
    .select({ marketId: marketRegion.marketId, code: marketRegion.countryCode })
    .from(marketRegion)
    .where(
      inArray(
        marketRegion.marketId,
        rows.map((r) => r.m.id),
      ),
    )
    .orderBy(asc(marketRegion.countryCode))
  return rows.map(({ m, hostname }) => {
    const { storeId: _storeId, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = m
    const countries = regions.filter((r) => r.marketId === m.id).map((r) => r.code)
    return { ...rest, countries, hostname }
  })
}

/** Every market of the store with its countries, the primary market first, then A–Z. */
export async function listMarkets(ctx: StoreContext): Promise<MarketView[]> {
  await ensurePrimaryMarket(ctx.tx, ctx.storeId)
  return views(ctx.tx)
}

export async function getMarket(ctx: StoreContext, id: string): Promise<MarketView> {
  const [view] = await views(ctx.tx, id)
  if (!view) throw new MarketError('MARKET_NOT_FOUND', 'Market not found', ctx.storeId)
  return view
}

/** A handle no other market of the store has: `gulf`, then `gulf-2`. */
async function freeHandle(tx: StoreTx, name: string): Promise<string> {
  const base = slugify(name).slice(0, 60) || 'market'
  const rows = await tx
    .select({ handle: market.handle })
    .from(market)
    .where(or(eq(market.handle, base), like(market.handle, `${base}-%`)))
  const used = new Set(rows.map((r) => r.handle))
  let handle = base
  for (let n = 2; used.has(handle); n++) handle = `${base}-${n}`
  return handle
}

/**
 * The store's primary market (India, the store's own currency, no subfolder), created when it
 * is missing: 0177 made one for every store that existed then; createStore makes it since.
 */
export async function ensurePrimaryMarket(tx: StoreTx, storeId: string): Promise<void> {
  const [primary] = await tx
    .select({ id: market.id })
    .from(market)
    .where(eq(market.isPrimary, true))
    .limit(1)
  if (primary) return
  const [own] = await tx
    .select({ currency: store.currency })
    .from(store)
    .where(eq(store.id, storeId))
  const currency = own?.currency.toUpperCase() ?? ''
  const [row] = await tx
    .insert(market)
    .values({
      storeId,
      name: 'India',
      handle: await freeHandle(tx, 'India'),
      isPrimary: true,
      currency: /^[A-Z]{3}$/.test(currency) ? currency : 'INR',
    })
    .onConflictDoNothing()
    .returning({ id: market.id })
  if (!row) return
  await tx
    .insert(marketRegion)
    .values({ storeId, marketId: row.id, countryCode: 'IN' })
    .onConflictDoNothing()
}

/**
 * A domain a market may newly open on: the store's own (read under RLS, so never another
 * store's), live, not the main domain or one that redirects to it, and no other market's.
 */
async function checkDomain(
  ctx: StoreContext,
  domainId: string,
  others: readonly MarketView[],
): Promise<void> {
  const invalid = (message: string) => new MarketError('MARKET_INVALID', message, ctx.storeId)
  const [domain] = await ctx.tx.select().from(storeDomain).where(eq(storeDomain.id, domainId))
  if (!domain) throw invalid('Pick one of your own domains')
  if (domain.isPrimary) {
    throw invalid(`${domain.hostname} is your main domain: it opens the primary market`)
  }
  if (domain.redirectToPrimary) {
    throw invalid(`${domain.hostname} sends shoppers to your main domain. Change that in Domains.`)
  }
  if (domain.status !== 'active') throw invalid(`${domain.hostname} is not connected yet`)
  const taken = others.find((m) => m.storeDomainId === domainId)
  if (taken) {
    throw new MarketError(
      'MARKET_CONFLICT',
      `${domain.hostname} already opens the ${taken.name} market`,
      ctx.storeId,
    )
  }
}

/** Refuses a draft that breaks a rule the database cannot check on its own. */
async function checkDraft(ctx: StoreContext, d: Draft, self: MarketView | null): Promise<void> {
  const invalid = (message: string) => new MarketError('MARKET_INVALID', message, ctx.storeId)
  const conflict = (message: string) => new MarketError('MARKET_CONFLICT', message, ctx.storeId)
  const isPrimary = self?.isPrimary ?? false

  const unknown = d.countries.find((c) => !isCountryCode(c))
  if (unknown) throw invalid(`${unknown} is not a country code`)
  if (!isPrimary && d.countries.length === 0) throw invalid('Add at least one country')
  if (!isCurrency(d.currency)) throw invalid(`${d.currency} is not a currency code`)
  if (d.subfolder !== null) {
    if (isPrimary) throw invalid('The primary market opens on your main address, not a subfolder')
    if (!SUBFOLDER_PATTERN.test(d.subfolder)) {
      throw invalid('A subfolder is two letters, like ae, or two pairs, like en-us')
    }
    if (d.storeDomainId !== null) throw invalid('Pick one way in: a subfolder or a domain')
  }
  if (isPrimary && d.storeDomainId !== null) {
    throw invalid('The primary market opens on your main domain')
  }

  const others = (await views(ctx.tx)).filter((m) => m.id !== self?.id)
  // Only a domain that changes: one that stopped resolving later must not block a rename.
  if (d.storeDomainId !== null && d.storeDomainId !== (self?.storeDomainId ?? null)) {
    await checkDomain(ctx, d.storeDomainId, others)
  }
  const clash = pathClash({ isPrimary, ...d }, others)
  if (clash) throw conflict(`/${clash.path} already opens the ${clash.market.name} market`)
  for (const other of others) {
    const shared = other.countries.find((c) => d.countries.includes(c))
    if (shared) throw conflict(`${countryName(shared)} is already in the ${other.name} market`)
  }
}

/** Runs the writes; two saves racing for one country or subfolder lose with a clear message. */
async function writing<T>(ctx: StoreContext, write: () => Promise<T>): Promise<T> {
  try {
    return await write()
  } catch (err) {
    if (!isUniqueViolation(err)) throw err
    throw new MarketError(
      'MARKET_CONFLICT',
      'Another market took one of these countries or addresses just now. Reload and try again.',
      ctx.storeId,
    )
  }
}

export async function createMarket(
  ctx: StoreContext,
  raw: z.input<typeof MarketCreateSchema>,
): Promise<MarketView> {
  const draft = normalise(MarketCreateSchema.parse(raw))
  // Before the checks, so a market made ahead of the primary never takes India from it.
  await ensurePrimaryMarket(ctx.tx, ctx.storeId)
  await checkDraft(ctx, draft, null)
  const handle = await freeHandle(ctx.tx, draft.name)
  const id = await writing(ctx, async () => {
    const [row] = await ctx.tx
      .insert(market)
      .values({ storeId: ctx.storeId, handle, ...columnsOf(draft) })
      .returning({ id: market.id })
    if (!row) throw new MarketError('MARKET_INVALID', 'The market was not saved', ctx.storeId)
    await ctx.tx.insert(marketRegion).values(
      draft.countries.map((countryCode) => ({
        storeId: ctx.storeId,
        marketId: row.id,
        countryCode,
      })),
    )
    return row.id
  })
  return getMarket(ctx, id)
}

/** The primary market keeps its countries, currency and prices; its name and languages change. */
function keepsPrimaryWhole(current: MarketView, next: Draft): boolean {
  const rate = (v: string | null) => (v === null ? null : Number(v))
  return (
    next.currency === current.currency &&
    next.countries.length === current.countries.length &&
    next.countries.every((c) => current.countries.includes(c)) &&
    next.priceAdjustmentBp === current.priceAdjustmentBp &&
    next.rounding === current.rounding &&
    rate(next.manualRate) === rate(current.manualRate) &&
    next.duties === current.duties
  )
}

export async function updateMarket(
  ctx: StoreContext,
  raw: z.input<typeof MarketUpdateSchema>,
): Promise<MarketView> {
  const { id, ...changes } = MarketUpdateSchema.parse(raw)
  const current = await getMarket(ctx, id)
  const sent = Object.entries(changes).filter(([, v]) => v !== undefined)
  const draft = normalise({ ...draftOf(current), ...(Object.fromEntries(sent) as Partial<Draft>) })
  if (current.isPrimary && !keepsPrimaryWhole(current, draft)) {
    throw new MarketError(
      'MARKET_INVALID',
      `${current.name} is your primary market: its country, currency and prices stay as they are. Only its name and languages change.`,
      ctx.storeId,
    )
  }
  await checkDraft(ctx, draft, current)
  const gone = current.countries.filter((c) => !draft.countries.includes(c))
  const added = draft.countries.filter((c) => !current.countries.includes(c))
  await writing(ctx, async () => {
    await ctx.tx
      .update(market)
      .set({ ...columnsOf(draft), updatedAt: new Date() })
      .where(eq(market.id, id))
    if (gone.length > 0) {
      await ctx.tx
        .delete(marketRegion)
        .where(and(eq(marketRegion.marketId, id), inArray(marketRegion.countryCode, gone)))
    }
    if (added.length > 0) {
      await ctx.tx
        .insert(marketRegion)
        .values(added.map((countryCode) => ({ storeId: ctx.storeId, marketId: id, countryCode })))
    }
  })
  return getMarket(ctx, id)
}

/** Turns a market on or off. The primary market is always on. */
export async function setMarketEnabled(
  ctx: StoreContext,
  raw: z.input<typeof MarketEnabledSchema>,
): Promise<MarketView> {
  const input = MarketEnabledSchema.parse(raw)
  const current = await getMarket(ctx, input.id)
  if (current.isPrimary && !input.enabled) {
    throw new MarketError('MARKET_INVALID', 'The primary market is always on', ctx.storeId)
  }
  await ctx.tx
    .update(market)
    .set({ enabled: input.enabled, updatedAt: new Date() })
    .where(eq(market.id, current.id))
  return { ...current, enabled: input.enabled }
}

/**
 * Deletes a market and its countries. One with orders is turned off instead, so those orders
 * keep the market they were placed in. The primary market stays.
 */
export async function deleteMarket(
  ctx: StoreContext,
  raw: z.input<typeof MarketIdSchema>,
): Promise<{ outcome: 'deleted' | 'disabled' }> {
  const input = MarketIdSchema.parse(raw)
  const current = await getMarket(ctx, input.id)
  if (current.isPrimary) {
    throw new MarketError(
      'MARKET_INVALID',
      `${current.name} is your primary market: it can't be deleted`,
      ctx.storeId,
    )
  }
  const [withOrder] = await ctx.tx
    .select({ id: order.id })
    .from(order)
    .where(eq(order.marketId, current.id))
    .limit(1)
  if (withOrder) {
    await ctx.tx
      .update(market)
      .set({ enabled: false, updatedAt: new Date() })
      .where(eq(market.id, current.id))
    return { outcome: 'disabled' }
  }
  await ctx.tx.delete(market).where(eq(market.id, current.id))
  return { outcome: 'deleted' }
}
