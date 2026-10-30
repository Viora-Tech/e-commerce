import { z } from 'zod'
import {
  freeShippingThreshold,
  quoteShipping,
  type ShippingCartMeasure,
  type ShippingDestination,
  type ShippingQuote,
  type ShippingRateOption,
  type ShippingZoneInput,
} from './rates'

/**
 * Shipping profiles: products with their own zones and rates (Shopify's delivery profiles,
 * taken as an idea, not copied). Pure, like `rates.ts`, so checkout, the order and the tests
 * run the same rule.
 *
 * THE RULE for a cart:
 * 1. Each line belongs to one profile: the custom profile its product is in, else General.
 * 2. Each profile in the cart is quoted on its own lines only (their value after discounts
 *    and their weight), against its own zones, exactly as a store without profiles is.
 * 3. One profile in the cart: its rates are the options, unchanged (every store before
 *    profiles, and every cart of General products only).
 * 4. Several profiles: the shopper still picks one option, which is one rate per profile,
 *    summed. The options are "cheapest of each", plus, for each rate name any profile offers,
 *    that name in every profile that has it and the cheapest elsewhere ("Express" picks
 *    Express wherever it exists). Same set of rates twice is one option; cheapest first.
 * 5. A profile in the cart that has no rate for the address (or no zones at all) means the
 *    cart cannot ship there. Only a store with no zones anywhere ships free, as before rates
 *    existed.
 */

export type ShippingProfileInput = {
  id: string
  name: string
  isDefault: boolean
  position: number
  zones: readonly ShippingZoneInput[]
}

/** The cart's lines of one profile, measured. */
export type ProfileCartPart = { profileId: string; measure: ShippingCartMeasure }

/** One profile's share of a combined option. */
export type ShippingOptionPart = {
  profileId: string
  profileName: string
  rateId: string
  name: string
  zoneId: string
  zoneName: string
  listPricePaise: number
  pricePaise: number
}

/** Rates of several profiles join their ids with this; a single rate's id is its own. */
export const RATE_ID_JOIN = '+'

/** The rate id an order row keeps (a uuid column): the first part of a joined id. */
export const primaryRateId = (rateId: string): string => rateId.split(RATE_ID_JOIN)[0] ?? rateId

/** General first, then the merchant's order. */
const profileOrder = (a: ShippingProfileInput, b: ShippingProfileInput) =>
  Number(b.isDefault) - Number(a.isDefault) || a.position - b.position

const maxOrNull = (values: (number | null)[]): number | null => {
  const known = values.filter((v): v is number => v !== null)
  return known.length ? Math.max(...known) : null
}

function combine(
  picked: { profile: ShippingProfileInput; option: ShippingRateOption }[],
): ShippingRateOption {
  const [lead] = picked
  if (!lead) throw new Error('combine needs at least one rate')
  const parts: ShippingOptionPart[] = picked.map(({ profile, option }) => ({
    profileId: profile.id,
    profileName: profile.name,
    rateId: option.rateId,
    name: option.name,
    zoneId: option.zoneId,
    zoneName: option.zoneName,
    listPricePaise: option.listPricePaise,
    pricePaise: option.pricePaise,
  }))
  const names: string[] = []
  for (const p of parts) {
    if (!names.some((n) => n.toLowerCase() === p.name.toLowerCase())) names.push(p.name)
  }
  return {
    rateId: parts.map((p) => p.rateId).join(RATE_ID_JOIN),
    name: names.join(' + '),
    zoneId: lead.option.zoneId,
    zoneName: lead.option.zoneName,
    listPricePaise: parts.reduce((sum, p) => sum + p.listPricePaise, 0),
    pricePaise: parts.reduce((sum, p) => sum + p.pricePaise, 0),
    // The highest COD fee any parcel sets; the parcels arrive when the slowest does.
    codSurchargePaise: maxOrNull(picked.map((p) => p.option.codSurchargePaise)),
    minTransitDays: maxOrNull(picked.map((p) => p.option.minTransitDays)),
    maxTransitDays: maxOrNull(picked.map((p) => p.option.maxTransitDays)),
    parts,
  }
}

/** The options of a cart whose lines span several profiles (rule 4). */
function combinedOptions(
  quoted: { profile: ShippingProfileInput; options: ShippingRateOption[] }[],
): ShippingRateOption[] {
  const names: string[] = []
  for (const q of quoted) {
    for (const o of q.options) {
      if (!names.some((n) => n.toLowerCase() === o.name.toLowerCase())) names.push(o.name)
    }
  }
  const pick = (name: string | null) =>
    quoted.map(({ profile, options }) => ({
      profile,
      option:
        (name && options.find((o) => o.name.toLowerCase() === name.toLowerCase())) ||
        (options[0] as ShippingRateOption),
    }))
  const seen = new Set<string>()
  const out: ShippingRateOption[] = []
  for (const name of [null, ...names]) {
    const option = combine(pick(name))
    if (seen.has(option.rateId)) continue
    seen.add(option.rateId)
    out.push(option)
  }
  return out.sort((a, b) => a.pricePaise - b.pricePaise)
}

/** The rates for a cart split by profile, going to `to` (the rule at the top of this file). */
export function quoteProfiles(
  profiles: readonly ShippingProfileInput[],
  parts: readonly ProfileCartPart[],
  to: ShippingDestination,
): ShippingQuote {
  if (profiles.every((p) => p.zones.length === 0)) return { kind: 'not_configured' }
  const general = profiles.find((p) => p.isDefault)
  const byId = new Map(profiles.map((p) => [p.id, p]))
  const quoted: { profile: ShippingProfileInput; options: ShippingRateOption[] }[] = []
  for (const part of parts) {
    const profile = byId.get(part.profileId) ?? general
    if (!profile) return { kind: 'no_rates' }
    const quote = quoteShipping(profile.zones, to, part.measure)
    if (quote.kind !== 'rates') return { kind: 'no_rates' }
    quoted.push({ profile, options: quote.options })
  }
  quoted.sort((a, b) => profileOrder(a.profile, b.profile))
  const [only] = quoted
  if (!only) return { kind: 'no_rates' }
  if (quoted.length === 1) return { kind: 'rates', options: only.options }
  return { kind: 'rates', options: combinedOptions(quoted) }
}

/**
 * The order value from which shipping is free wherever the parcel goes, for a cart holding
 * products of `profileIds` (General when empty): the highest of their thresholds, null when
 * any of them makes no such promise.
 */
export function profilesFreeShippingThreshold(
  profiles: readonly ShippingProfileInput[],
  profileIds: readonly string[],
): number | null {
  const general = profiles.find((p) => p.isDefault)
  const wanted = profileIds.length ? [...new Set(profileIds)] : general ? [general.id] : []
  let threshold: number | null = 0
  for (const id of wanted) {
    const profile = profiles.find((p) => p.id === id) ?? general
    const own = profile ? freeShippingThreshold(profile.zones) : null
    if (own === null) return null
    threshold = Math.max(threshold, own)
  }
  return wanted.length ? threshold : null
}

/**
 * Split a value (the cart after discounts) across profiles in proportion to their lines'
 * subtotal, in whole minor units; the last profile takes the remainder so the parts add up.
 */
export function splitValue(total: number, subtotals: readonly number[]): number[] {
  const sum = subtotals.reduce((a, b) => a + b, 0)
  if (sum <= 0) return subtotals.map((_, i) => (i === 0 ? total : 0))
  let left = total
  return subtotals.map((s, i) => {
    if (i === subtotals.length - 1) return left
    const share = Math.floor((total * s) / sum)
    left -= share
    return share
  })
}

export const ShippingProfileWriteSchema = z.object({
  name: z.string().trim().min(1, 'Give the profile a name').max(80),
  productIds: z.array(z.uuid()).max(5000).default([]),
})
export type ShippingProfileWrite = z.infer<typeof ShippingProfileWriteSchema>
