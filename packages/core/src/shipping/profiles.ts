/** SOURCE OF TRUTH: shipping profiles — WHAT: the rates for a cart split by profile (products with their own zones and rates) / WHY: pure, so checkout, the order and the tests run the same rule */
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
 * 0. Lines that need no shipping (gift cards, variants with "requires shipping" off) are left
 *    out; a cart with no other line ships nothing. Their share of the cart's value is too.
 * 1. Each line belongs to one profile: the profile its variant was placed in on its own, else
 *    the profile its product is in, else General.
 * 2. Each profile in the cart is quoted on its own lines only (their value after discounts
 *    and their weight), against its own zones, exactly as a store without profiles is.
 * 3. One profile in the cart: its rates are the options, unchanged (every store before
 *    profiles, and every cart of General products only).
 * 4. Several profiles: the shopper still picks one option, which is one rate per profile,
 *    charged once at the highest of those rates, as one parcel. The options are "cheapest of each", plus, for each rate name any profile offers,
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
const RATE_ID_JOIN = '+'

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
    // One delivery charge for the order: the dearest profile's, never the profiles added up.
    listPricePaise: Math.max(...parts.map((p) => p.listPricePaise)),
    pricePaise: Math.max(...parts.map((p) => p.pricePaise)),
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
function splitValue(total: number, subtotals: readonly number[]): number[] {
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

/**
 * The profile a line ships under (rule 1): its variant's own placement wins, then its
 * product's, then General.
 */
export function lineProfileId(
  line: { variantId: string; productId: string },
  byVariant: ReadonlyMap<string, string>,
  byProduct: ReadonlyMap<string, string>,
  generalId: string,
): string {
  return byVariant.get(line.variantId) ?? byProduct.get(line.productId) ?? generalId
}

/** A cart or order line as the profile split reads it. */
export type ProfileSplitLine = {
  quantity: number
  unitPricePaise: number
  weightGrams: number | null
  /** Gift cards are emailed, never shipped. */
  giftCard: boolean
  /** The variant's "requires shipping"; left out counts as true (older callers). */
  requiresShipping?: boolean | undefined
}

/** Whether a line goes in a parcel: not a gift card and its variant requires shipping. */
export const lineShips = (l: Pick<ProfileSplitLine, 'giftCard' | 'requiresShipping'>): boolean =>
  !l.giftCard && l.requiresShipping !== false

/**
 * The cart split into profile parts (rules 0 to 2). `profileOf` names each shipping line's
 * profile. `valuePaise` is the whole cart after discounts: a cart whose every line ships in one
 * profile is measured on it whole, exactly as before profiles; otherwise each part (and the
 * lines that do not ship) takes its share in proportion to its subtotal. `measure` is what the
 * shipping lines add up to; null when nothing ships.
 */
export function splitProfileParts<L extends ProfileSplitLine>(
  lines: readonly L[],
  valuePaise: number,
  profileOf: (line: L) => string,
): { parts: ProfileCartPart[]; measure: ShippingCartMeasure | null } {
  const weightOf = (ls: readonly L[]) =>
    ls.reduce((sum, l) => sum + l.quantity * (l.weightGrams ?? 0), 0)
  const subtotalOf = (ls: readonly L[]) =>
    ls.reduce((sum, l) => sum + l.quantity * l.unitPricePaise, 0)
  const shipped = lines.filter(lineShips)
  if (shipped.length === 0) return { parts: [], measure: null }
  const groups = new Map<string, L[]>()
  for (const l of shipped) {
    const id = profileOf(l)
    groups.set(id, [...(groups.get(id) ?? []), l])
  }
  const entries = [...groups]
  const rest = lines.filter((l) => !lineShips(l))
  if (entries.length === 1 && rest.length === 0) {
    const measure = { valuePaise, weightGrams: weightOf(shipped) }
    return { parts: [{ profileId: entries[0]?.[0] as string, measure }], measure }
  }
  // The lines that do not ship take their share last, so the parts never count it; without
  // them the last profile takes the remainder, as before.
  const values = splitValue(valuePaise, [
    ...entries.map(([, ls]) => subtotalOf(ls)),
    ...(rest.length ? [subtotalOf(rest)] : []),
  ])
  const parts = entries.map(([profileId, ls], i) => ({
    profileId,
    measure: { valuePaise: values[i] ?? 0, weightGrams: weightOf(ls) },
  }))
  const measure = {
    valuePaise: parts.reduce((sum, p) => sum + p.measure.valuePaise, 0),
    weightGrams: weightOf(shipped),
  }
  return { parts, measure }
}

export const ShippingProfileWriteSchema = z.object({
  name: z.string().trim().min(1, 'Give the profile a name').max(80),
  /** Whole products: every variant, including ones added later, unless placed elsewhere alone. */
  productIds: z.array(z.uuid()).max(5000).default([]),
  /** Variants placed in this profile on their own; they win over their product's profile. Left
   *  out keeps the profile's variants as they are (callers that only know products). */
  variantIds: z.array(z.uuid()).max(5000).optional(),
})
export type ShippingProfileWrite = z.infer<typeof ShippingProfileWriteSchema>
