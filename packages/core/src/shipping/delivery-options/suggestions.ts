/** SOURCE OF TRUTH: product rules suggested from Settings → Shipping rates — WHAT: turns the
 * store's shipping profiles (their products, India zones and rates) into suggested Delivery
 * options rules: a custom profile becomes a rule for its products at its lowest rate (Fixed ₹,
 * or Free) and its free-above threshold; the General profile becomes an "All products" rule at
 * the normal price, free above its threshold / WHY: owner, 20 Nov 2026: Waimers' "Skates"
 * profile (₹99 / ₹139, 33 products) should not have to be typed again as a rule. A suggestion
 * saves nothing; the admin opens the rule dialog filled with it. `ruleSuggestions` is pure.
 */
import type { StoreTx } from '@commerce/db'
import { getShippingProfile, listShippingProfiles } from '../profiles-service'
import { freeShippingThreshold, type ShippingZoneInput, zoneCoversIndia } from '../rates'
import type { RouteRule, RulePrice, RuleTargetKind } from './config'

/** One shipping profile as the suggestions read it. */
export type SuggestionProfile = {
  id: string
  name: string
  isDefault: boolean
  /** Products in a custom profile (whole, or with a variant there); `[]` for General. */
  products: Array<{ id: string; title: string }>
  zones: readonly ShippingZoneInput[]
}

export type RuleSuggestion = {
  /** The profile it comes from. */
  profileId: string
  name: string
  target: { kind: RuleTargetKind; values: string[] }
  /** Product titles, in `target.values` order. */
  titles: string[]
  price: RulePrice
  /** What the profile charges in India: its lowest and highest rate, null with no rate. */
  lowestPaise: number | null
  highestPaise: number | null
}

const sameSet = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((v) => b.includes(v))

/**
 * The rules the store's shipping profiles suggest, skipping a profile an existing rule already
 * covers (the same name, the same products, or an "All products" rule for General) and one with
 * no India rate or no products.
 */
export function ruleSuggestions(
  profiles: readonly SuggestionProfile[],
  rules: readonly Pick<RouteRule, 'name' | 'target'>[],
): RuleSuggestion[] {
  const names = new Set(rules.map((r) => r.name.trim().toLowerCase()))
  const out: RuleSuggestion[] = []
  for (const p of profiles) {
    const zones = p.zones.filter(zoneCoversIndia)
    const prices = zones.flatMap((z) => z.rates.map((r) => r.pricePaise))
    if (prices.length === 0) continue
    const lowest = Math.min(...prices)
    const highest = Math.max(...prices)
    const freeAbove = freeShippingThreshold(zones)
    if (p.isDefault) {
      if (rules.some((r) => r.target.kind === 'all')) continue
      out.push({
        profileId: p.id,
        name: p.name,
        target: { kind: 'all', values: [] },
        titles: [],
        price: lowest === 0 ? { mode: 'free' } : { mode: 'option', freeAbovePaise: freeAbove },
        lowestPaise: lowest,
        highestPaise: highest,
      })
      continue
    }
    const ids = p.products.map((x) => x.id)
    if (ids.length === 0 || names.has(p.name.trim().toLowerCase())) continue
    if (rules.some((r) => r.target.kind === 'products' && sameSet(r.target.values, ids))) continue
    out.push({
      profileId: p.id,
      name: p.name,
      target: { kind: 'products', values: ids },
      titles: p.products.map((x) => x.title),
      price:
        lowest === 0
          ? { mode: 'free' }
          : { mode: 'fixed', fixedPaise: lowest, freeAbovePaise: freeAbove },
      lowestPaise: lowest,
      highestPaise: highest,
    })
  }
  // Custom profiles first (they are the ones worth a rule), General last.
  return out.sort((a, b) => Number(a.target.kind === 'all') - Number(b.target.kind === 'all'))
}

/** The store's shipping profiles, read for `ruleSuggestions`. RLS scopes the rows. */
export async function loadSuggestionProfiles(
  tx: StoreTx,
  storeId: string,
): Promise<SuggestionProfile[]> {
  const profiles = await listShippingProfiles(tx, storeId)
  return Promise.all(
    profiles.map(async (p) => {
      const detail = p.isDefault ? null : await getShippingProfile(tx, storeId, p.id)
      return {
        id: p.id,
        name: p.name,
        isDefault: p.isDefault,
        products: (detail?.entries ?? []).map((e) => ({ id: e.productId, title: e.title })),
        zones: p.zones.map((z) => ({
          id: z.id,
          name: z.name,
          countryCodes: z.countryCodes,
          stateCodes: z.stateCodes,
          pincodeRules: z.pincodeRules,
          position: z.position,
          rates: z.rates,
        })),
      }
    }),
  )
}
