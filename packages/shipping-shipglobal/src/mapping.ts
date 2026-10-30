/**
 * Pure mapping helpers for the ShipGlobal adapter: which service a parcel books, the token's
 * lifetime, and how names, phones and street lines fit ShipGlobal's order fields
 * (https://labels.shipglobal.in/api-docs.php).
 */

import { isDomesticCountry, type ShipmentAddress, wrapAddressLines } from '@commerce/shipping'
import { SHIPGLOBAL_SERVICES, type ShipglobalServiceCode } from './client'

/** Used when `expires_at` does not parse. VERIFY: the real token lifetime. */
const FALLBACK_TOKEN_LIFETIME_MS = 60 * 60 * 1000
/** USPS takes US parcels up to this weight, UPS above it (docs, "Supported Services"). */
const USPS_MAX_GRAMS = 5000
/** VERIFY: ShipGlobal's per-line limit for address lines; 50 is a safe guess. */
const ADDRESS_LINE_MAX = 50

export const SERVICE_CODES = new Set<string>([...SHIPGLOBAL_SERVICES.map((s) => s.code), 'UPS'])

const isUsOnly = (service: string) => service === 'USPS' || service === 'UPS'

/**
 * The service a parcel books: the rate table's pick or the configured default, with the US
 * pair split by weight as the docs require (USPS up to 5 kg, UPS above). Null when the
 * service does not go to this country.
 */
export function shipglobalService(
  chosen: string | undefined,
  fallback: ShipglobalServiceCode,
  country: string,
  weightGrams: number,
): ShipglobalServiceCode | null {
  const service = (chosen && SERVICE_CODES.has(chosen) ? chosen : fallback) as ShipglobalServiceCode
  if (!isUsOnly(service)) return service
  if (country.trim().toUpperCase() !== 'US') return null
  return weightGrams > USPS_MAX_GRAMS ? 'UPS' : 'USPS'
}

/**
 * `expires_at` is "YYYY-MM-DD HH:MM:SS" with no zone. VERIFY: the zone; read as India time,
 * which errs early for any zone west of India (a token fetched again a bit sooner).
 */
export function tokenLifetimeMs(expiresAt: string | undefined, now: Date): number {
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})$/.exec(expiresAt?.trim() ?? '')
  if (!m) return FALLBACK_TOKEN_LIFETIME_MS
  const at = new Date(`${m[1]}T${m[2]}+05:30`).getTime()
  const ms = at - now.getTime()
  return Number.isFinite(ms) && ms > 0 ? ms : FALLBACK_TOKEN_LIFETIME_MS
}

/** "Asha Verma" → Asha / Verma. One word fills both: the docs mark the last name mandatory. */
export function splitName(name: string): { first: string; last: string } {
  const [first = name, ...rest] = name.trim().split(/\s+/)
  return { first, last: rest.join(' ') || first }
}

/** Indian 10-digit mobiles get +91; anything else goes as typed (the docs' samples are E.164). */
export function phoneOf(raw: string, country: string): string {
  const digits = raw.replace(/\D/g, '')
  if (isDomesticCountry(country)) {
    const local = digits.replace(/^(91|0)(?=\d{10}$)/, '')
    return /^\d{10}$/.test(local) ? `+91${local}` : raw.trim()
  }
  return raw.trim().startsWith('+') ? `+${digits}` : raw.trim()
}

/** The three street lines. The docs mark the second mandatory, so it falls back to the city. */
export function streetLines(a: ShipmentAddress): [string, string, string | undefined] {
  const [one = a.city, two, three] = wrapAddressLines([a.line1, a.line2], ADDRESS_LINE_MAX, 3)
  return [one, two ?? a.city, three]
}

export const rupees = (paise: number) => Math.round(paise) / 100
export const cm = (n: number) => Math.max(Math.ceil(n), 1)
