/** SOURCE OF TRUTH: checkout addresses abroad
 * WHAT:  The countries a checkout can ship to, the loose postcode check per country, the
 *        region rule, a phone abroad, and the GST regime an order to that country gets.
 * WHY:   Country zones (audit #160) price an address abroad; the storefront form and
 *        `placeOrder` must agree on what such an address needs. India keeps its own PIN code,
 *        state and courier checks (`checkout/settings.ts`, `pincode-state.ts`).
 * WHERE: Pure; also `@commerce/core/checkout-address` for the storefront form.
 */
import { normalisePhone } from '../accounts/phone'
import { regionCodeOf, regionList, regionNameOf } from './regions-abroad'

export { regionList } from './regions-abroad'

/** The store's own country: PIN code, Indian states, courier estimate, GST. */
const HOME_COUNTRY = 'IN'

/** A shipping zone's "Rest of world" entry (`shipping/rates.ts` `REST_OF_WORLD`). */
const REST_OF_WORLD = '*'

/** Longest region (state, province, emirate) and postcode kept. */
export const ABROAD_LIMITS = { region: 80, postalCode: 12 } as const

/**
 * ISO 3166-1 alpha-2 codes a "Rest of world" zone offers in the country list. Territories with
 * no postal service of their own (AQ, BV, HM, UM) are left out.
 */
const WORLD =
  'AD AE AF AG AI AL AM AO AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW'.split(
    ' ',
  )

/** "au", " AU ", undefined → "AU" / "IN": the country a checkout address is judged by. */
export function checkoutCountry(raw: unknown): string {
  const code = typeof raw === 'string' ? raw.trim().toUpperCase() : ''
  return /^[A-Z]{2}$/.test(code) ? code : HOME_COUNTRY
}

export const isAbroad = (countryCode: unknown): boolean =>
  checkoutCountry(countryCode) !== HOME_COUNTRY

/**
 * The countries the checkout offers: India, then every country a shipping zone names, sorted;
 * a "Rest of world" zone opens every country. `zoneCountries` is each zone's `country_codes`.
 */
export function checkoutCountries(zoneCountries: readonly (readonly string[])[]): string[] {
  const named = zoneCountries.flat().map((c) => c.trim().toUpperCase())
  const pool = named.includes(REST_OF_WORLD) ? WORLD : named.filter((c) => /^[A-Z]{2}$/.test(c))
  const abroad = [...new Set(pool)].filter((c) => c !== HOME_COUNTRY).sort()
  return [HOME_COUNTRY, ...abroad]
}

/**
 * The country the form opens on: the shopper's market country when it is abroad and the store
 * ships there; else, on the home market, the country they browse from (Cloudflare's edge
 * country) when the store ships there; else India.
 */
export function defaultCheckoutCountry(
  marketCountry: string | null | undefined,
  offered: readonly string[],
  visitorCountry?: string | null,
): string {
  const code = checkoutCountry(marketCountry)
  if (code !== HOME_COUNTRY && offered.includes(code)) return code
  const visitor = checkoutCountry(visitorCountry)
  return offered.includes(visitor) ? visitor : HOME_COUNTRY
}

type PostcodeRule = { pattern: RegExp; required: boolean }

/*
 * Loose shapes for countries with a well-known postcode; anything else takes 2 to 10 letters,
 * digits, spaces or dashes. Loose on purpose: a courier abroad reads the label, and refusing a
 * real address costs a sale. Where most addresses have no postcode it is optional.
 */
const POSTCODES: Record<string, PostcodeRule> = {
  US: { pattern: /^\d{5}(-\d{4})?$/, required: true },
  CA: { pattern: /^[A-Z]\d[A-Z] ?\d[A-Z]\d$/, required: true },
  GB: { pattern: /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/, required: true },
  AU: { pattern: /^\d{4}$/, required: true },
  NZ: { pattern: /^\d{4}$/, required: true },
  SG: { pattern: /^\d{6}$/, required: true },
  DE: { pattern: /^\d{5}$/, required: true },
  FR: { pattern: /^\d{5}$/, required: true },
  IT: { pattern: /^\d{5}$/, required: true },
  ES: { pattern: /^\d{5}$/, required: true },
  MY: { pattern: /^\d{5}$/, required: true },
  NL: { pattern: /^\d{4} ?[A-Z]{2}$/, required: true },
  JP: { pattern: /^\d{3}-?\d{4}$/, required: true },
  NP: { pattern: /^\d{5}$/, required: false },
  LK: { pattern: /^\d{5}$/, required: false },
  AE: { pattern: /^[A-Z0-9 -]{2,10}$/, required: false },
  QA: { pattern: /^[A-Z0-9 -]{2,10}$/, required: false },
  HK: { pattern: /^[A-Z0-9 -]{2,10}$/, required: false },
  IE: { pattern: /^[A-Z]\d[\dW] ?[A-Z\d]{4}$/, required: false },
}

const ANY_POSTCODE: PostcodeRule = { pattern: /^[A-Z0-9][A-Z0-9 -]{1,9}$/, required: true }

/** The postcode as stored: trimmed, upper case, single spaces. */
export const cleanPostalCode = (raw: string): string =>
  raw.trim().toUpperCase().replace(/\s+/g, ' ')

/** Whether a postcode must be given in this country (the form marks it optional otherwise). */
export const postalCodeRequired = (countryCode: string): boolean =>
  (POSTCODES[checkoutCountry(countryCode)] ?? ANY_POSTCODE).required

/** What is wrong with a postcode abroad: `missing`, `invalid`, or null when it will do. */
export function postalCodeProblem(countryCode: string, raw: string): 'missing' | 'invalid' | null {
  const rule = POSTCODES[checkoutCountry(countryCode)] ?? ANY_POSTCODE
  const code = cleanPostalCode(raw)
  if (!code) return rule.required ? 'missing' : null
  if (code.length > ABROAD_LIMITS.postalCode) return 'invalid'
  return rule.pattern.test(code) ? null : 'invalid'
}

/** Countries whose addresses always name a state or province. */
const REGION_REQUIRED = new Set(['US', 'CA', 'AU', 'MY', 'MX', 'BR', 'CN', 'JP'])

export const regionRequired = (countryCode: string): boolean =>
  REGION_REQUIRED.has(checkoutCountry(countryCode))

/** "", "New South Wales  " → null / "New South Wales"; capped at the column's limit. */
export function cleanRegion(raw: string | null | undefined): string | null {
  const text = raw?.trim().replace(/\s+/g, ' ') ?? ''
  return text ? text.slice(0, ABROAD_LIMITS.region) : null
}

/**
 * A region abroad as it is stored: `code` goes in `state_code` (the postal code where the
 * country's regions are listed, "CA" for California, which FedEx and ShipGlobal need; else the
 * text as typed), `name` in `province` for labels and the admin. Null when nothing was given.
 */
export function abroadRegion(
  countryCode: string,
  raw: string | null | undefined,
): { code: string; name: string } | null {
  const text = cleanRegion(raw)
  if (!text) return null
  const country = checkoutCountry(countryCode)
  const code = regionCodeOf(country, text)
  return code ? { code, name: regionNameOf(country, code) } : { code: text, name: text }
}

/**
 * A phone for an address abroad, in E.164: any valid number, read in the destination's
 * country when typed without "+" (a shopper abroad may still give an Indian mobile). Null when
 * it is not a number.
 */
export const abroadPhone = (raw: string, countryCode: string): string | null =>
  normalisePhone(raw, checkoutCountry(countryCode) as Parameters<typeof normalisePhone>[1])

export type AbroadAddressInput = {
  countryCode: string
  stateCode: string
  pincode: string
}

/**
 * The address fields abroad that are wrong, by the checkout's field keys (`stateCode` is the
 * region, `pincode` the postcode). India is judged elsewhere; this returns {} for it.
 */
export function abroadAddressErrors(
  a: AbroadAddressInput,
  messages: { postcode: string; postcodeInvalid: string; region: string; regionInvalid: string },
): Partial<Record<'stateCode' | 'pincode', string>> {
  if (!isAbroad(a.countryCode)) return {}
  const errors: Partial<Record<'stateCode' | 'pincode', string>> = {}
  const problem = postalCodeProblem(a.countryCode, a.pincode)
  if (problem === 'missing') errors.pincode = messages.postcode
  if (problem === 'invalid') errors.pincode = messages.postcodeInvalid
  const country = checkoutCountry(a.countryCode)
  const region = cleanRegion(a.stateCode)
  if (regionRequired(country) && !region) {
    errors.stateCode = messages.region
  } else if (region && regionList(country) && !regionCodeOf(country, region)) {
    // A listed country's region must be one of its own (the form offers them as a list).
    errors.stateCode = messages.regionInvalid
  }
  return errors
}

/** How GST applies to an order (`order.tax_regime`). */
export type OrderTaxRegime = 'domestic_gst' | 'export_lut' | 'export_igst'

/**
 * The GST regime of an order shipped to this country. India is domestic GST. Abroad is an
 * export, zero-rated (IGST Act s.16): under a Letter of Undertaking no IGST is charged
 * (`export_lut`, the default, and what the GST invoices app prints unless it is set to
 * "IGST paid"); with the app on `igst` the IGST is paid and refunded later (`export_igst`).
 */
export function taxRegimeFor(
  countryCode: string | null | undefined,
  exportMode: 'lut' | 'igst' | null | undefined,
): OrderTaxRegime {
  if (!isAbroad(countryCode)) return 'domestic_gst'
  return exportMode === 'igst' ? 'export_igst' : 'export_lut'
}
