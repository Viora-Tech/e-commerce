import { stateCode } from '@commerce/core'
import type { CustomerAddress } from '@commerce/db'
import type { NAddress } from './types'

/** Shopify's Indian province codes that differ from ours. */
const SHOPIFY_STATE_ALIASES: Record<string, string> = {
  CT: 'CG',
  OR: 'OD',
  DD: 'DN',
  TG: 'TS',
  UT: 'UK',
}

/** Our two-letter state for a Shopify address; the raw code or name when it is not Indian. */
export function stateFor(a: Pick<NAddress, 'provinceCode' | 'province'>): string {
  const code = a.provinceCode?.trim().toUpperCase().replace(/^IN-/, '') ?? ''
  return (
    stateCode(SHOPIFY_STATE_ALIASES[code] ?? code) ??
    stateCode(a.province) ??
    (code || a.province?.trim() || '')
  )
}

/** ISO country code; Shopify CSVs sometimes carry the name instead. */
export function countryFor(a: Pick<NAddress, 'countryCode' | 'country'>): string {
  const code = a.countryCode?.trim().toUpperCase()
  if (code && /^[A-Z]{2}$/.test(code)) return code
  return a.country?.trim().toLowerCase() === 'india' || !a.country ? 'IN' : a.country.slice(0, 2)
}

export function customerAddress(a: NAddress): CustomerAddress {
  return {
    name: a.name,
    line1: [a.company, a.line1].filter(Boolean).join(', '),
    line2: a.line2,
    city: a.city,
    stateCode: stateFor(a),
    pincode: a.zip.replace(/\s/g, ''),
    country: countryFor(a),
    phone: a.phone,
  }
}
