/**
 * Speed Post Parcel prices from the published tariff (`data/speed-post-parcel-tariff.ts`), or from
 * the merchant's own rate card when they pasted one. Pure.
 */
import {
  CONTRACTUAL_TARIFF,
  GST_RATE,
  MAX_PARCEL_GRAMS,
  REGISTRATION_RUPEES,
  RETAIL_TARIFF,
  type TariffCard,
  type TariffZone,
} from './data/speed-post-parcel-tariff'

const ZONES: readonly TariffZone[] = ['local', 'withinState', 'metro', 'otherStates']

export type TariffPrice = {
  freightPaise: number
  registrationPaise: number
  codFeePaise: number
  gstPaise: number
  totalPaise: number
}

/** The freight for one parcel in rupees, before GST. Null above India Post's 35 kg limit. */
export function freightRupees(
  card: TariffCard,
  zone: TariffZone,
  weightGrams: number,
): number | null {
  if (weightGrams > MAX_PARCEL_GRAMS) return null
  const grams = Math.max(1, Math.ceil(weightGrams))
  const slab = card.slabs.find((s) => grams <= s.upToGrams)
  if (slab) return slab.rupees[zone]
  const last = card.slabs.at(-1)
  if (!last) return null
  const extraKg = Math.ceil((grams - last.upToGrams) / 1000)
  return last.rupees[zone] + extraKg * card.additionalKgRupees[zone]
}

/** Freight plus the extras the merchant picked, GST added on all of it. */
export function priceParcel(
  card: TariffCard,
  zone: TariffZone,
  weightGrams: number,
  extras: { registered: boolean; codFeePaise: number },
): TariffPrice | null {
  const rupees = freightRupees(card, zone, weightGrams)
  if (rupees === null) return null
  const freightPaise = rupees * 100
  const registrationPaise = extras.registered ? REGISTRATION_RUPEES * 100 : 0
  const codFeePaise = Math.max(0, Math.round(extras.codFeePaise))
  const gstPaise = Math.round((freightPaise + registrationPaise + codFeePaise) * GST_RATE)
  return {
    freightPaise,
    registrationPaise,
    codFeePaise,
    gstPaise,
    totalPaise: freightPaise + registrationPaise + codFeePaise + gstPaise,
  }
}

export function publishedCard(contractual: boolean): TariffCard {
  return contractual ? CONTRACTUAL_TARIFF : RETAIL_TARIFF
}

const isRupees = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0

function zoneRupees(raw: unknown): Record<TariffZone, number> | null {
  const r = raw as Record<string, unknown> | null
  if (!r || typeof r !== 'object') return null
  const out = {} as Record<TariffZone, number>
  for (const z of ZONES) {
    const v = r[z]
    if (!isRupees(v)) return null
    out[z] = v
  }
  return out
}

/**
 * The merchant's own rate card (Connect page, "Your own rates"), as JSON in the same shape as the
 * published one: `{ "slabs": [{ "upToGrams": 500, "rupees": { "local": 28, "withinState": 36,
 * "metro": 40, "otherStates": 47 } }, …], "additionalKgRupees": { … } }`. Rupees, GST extra.
 * Slabs must rise in weight. Returns the problem in plain words, for the settings form.
 */
export function parseTariffOverride(
  json: string,
): { ok: true; card: TariffCard } | { ok: false; error: string } {
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    return { ok: false, error: 'your own rates are not valid JSON' }
  }
  const r = raw as { slabs?: unknown; additionalKgRupees?: unknown } | null
  if (!r || !Array.isArray(r.slabs) || r.slabs.length === 0) {
    return { ok: false, error: 'your own rates need at least one weight slab' }
  }
  const slabs: TariffCard['slabs'] = []
  for (const s of r.slabs as Array<{ upToGrams?: unknown; rupees?: unknown }>) {
    const rupees = zoneRupees(s?.rupees)
    const upTo = s?.upToGrams
    if (typeof upTo !== 'number' || !Number.isInteger(upTo) || upTo <= 0 || !rupees) {
      return {
        ok: false,
        error: 'each slab needs upToGrams and rupees for local, withinState, metro, otherStates',
      }
    }
    const prev = slabs.at(-1)
    if (prev && upTo <= prev.upToGrams) {
      return { ok: false, error: 'weight slabs must go up in weight' }
    }
    slabs.push({ upToGrams: upTo, rupees })
  }
  const additionalKgRupees = zoneRupees(r.additionalKgRupees)
  if (!additionalKgRupees) {
    return { ok: false, error: 'your own rates need additionalKgRupees for every zone' }
  }
  return { ok: true, card: { slabs, additionalKgRupees } }
}
