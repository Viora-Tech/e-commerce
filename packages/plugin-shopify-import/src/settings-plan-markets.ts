/**
 * Store settings › markets: Shopify's markets (India plus the ones the merchant set up for
 * other countries) as markets here. Pure. A Shopify draft market comes over switched off, so
 * nothing changes for shoppers until the merchant turns it on. The market that sells in the
 * store's own country is the primary market here already and is never changed. A market whose
 * countries another market here already sells to is left for the merchant: importing it would
 * move those countries. Audit #114: Waimers had five markets on Shopify, one here.
 */
import { COUNTRY_CODES, isMarketLanguage, SUBFOLDER_PATTERN } from '@commerce/core'
import type { SettingsItem } from './settings-client'
import { type PartPlan, same } from './settings-plan'

/** A Shopify market as the Admin API gives it. */
export type NMarket = {
  sourceId: string
  name: string
  /** ACTIVE or DRAFT. */
  active: boolean
  countries: string[]
  currency: string | null
  locale: string | null
  locales: string[]
  subfolder: string | null
  /** The catalog's price list adjustment: +10% is 1000, −5% is −500. */
  adjustmentBp: number
}

/** A market here, as far as the plan needs it. */
export type LocalMarket = { name: string; isPrimary: boolean; countries: string[] }

/** What the import creates for one Shopify market (`createMarket`'s input, plus on/off). */
export type MarketWrite = {
  name: string
  countries: string[]
  currency: string
  locale: string
  locales: string[]
  subfolder: string | null
  priceAdjustmentBp: number
  enabled: boolean
}

const COUNTRIES = new Set(COUNTRY_CODES)

/** Shopify's `en-US`, `hi` → ours (`en`, `hi`); a language we do not offer is null. */
function language(locale: string | null | undefined): string | null {
  const code = (locale ?? '').toLowerCase().split('-')[0] ?? ''
  return isMarketLanguage(code) ? code : null
}

/** The market as a write here, or null when it has no country we know. */
function marketWrite(m: NMarket): MarketWrite | null {
  const countries = [...new Set(m.countries.map((c) => c.toUpperCase()))].filter((c) =>
    COUNTRIES.has(c),
  )
  if (!countries.length) return null
  const locale = language(m.locale) ?? 'en'
  const locales = [
    ...new Set(m.locales.map(language).filter((l): l is string => !!l && l !== locale)),
  ]
  const folder = (m.subfolder ?? '').toLowerCase()
  return {
    name: m.name.trim().slice(0, 80),
    countries: countries.sort(),
    currency: (m.currency ?? 'INR').toUpperCase(),
    locale,
    locales,
    subfolder: SUBFOLDER_PATTERN.test(folder) ? folder : null,
    // Our limits: −50% to +200%.
    priceAdjustmentBp: Math.max(-5000, Math.min(20000, Math.round(m.adjustmentBp))),
    enabled: m.active,
  }
}

export function planMarkets(source: readonly NMarket[], local: readonly LocalMarket[]): PartPlan {
  const items: SettingsItem[] = []
  const ops: PartPlan['ops'] = []
  // A store with no markets yet gets an India primary market on the first write.
  const home = local.find((m) => m.isPrimary)?.countries ?? ['IN']
  const taken = new Map<string, string>()
  for (const m of local) for (const c of m.countries) taken.set(c, m.name)
  for (const s of source) {
    const name = s.name.trim().slice(0, 80)
    if (!name) continue
    // The market selling in the store's own country is the primary market here.
    if (s.countries.some((c) => home.includes(c.toUpperCase()))) {
      items.push({ action: 'same', subject: 'market', name })
      continue
    }
    if (local.some((x) => same(x.name, name))) {
      items.push({ action: 'same', subject: 'market', name })
      continue
    }
    const write = marketWrite(s)
    if (!write) {
      items.push({ action: 'manual', subject: 'market', name, reason: 'market_countries' })
      continue
    }
    const clash = write.countries.filter((c) => taken.has(c))
    if (clash.length) {
      items.push({
        action: 'manual',
        subject: 'market',
        name,
        reason: 'market_country_taken',
        detail: clash.slice(0, 5).join(', '),
      })
      continue
    }
    for (const c of write.countries) taken.set(c, name)
    const shown = `${write.countries.length} · ${write.currency}${write.enabled ? '' : ' · draft'}`
    items.push({ action: 'create', subject: 'market', name, to: shown })
    ops.push({ kind: 'market', write })
  }
  return { items, ops }
}
