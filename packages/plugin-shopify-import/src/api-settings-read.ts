/** Shared Admin API reading helpers for the store settings import: paging, money, weights, addresses and one part's read. */

import type { NSettingsAddress, Read } from './api-settings'
import { ShopifyError } from './shopify-client'

export type Page<N> = { nodes: N[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } }
export const PAGE_INFO = 'pageInfo { hasNextPage endCursor }'
/** "50.00" rupees → 5000 paise. */
export const paiseOf = (amount: string | number | null | undefined): number =>
  Math.round(Number(amount ?? 0) * 100)

export const GRAMS_PER_UNIT: Record<string, number> = {
  GRAMS: 1,
  KILOGRAMS: 1000,
  OUNCES: 28.349523125,
  POUNDS: 453.59237,
}

export type GAddress = {
  address1?: string | null
  address2?: string | null
  city?: string | null
  province?: string | null
  provinceCode?: string | null
  countryCodeV2?: string | null
  countryCode?: string | null
  zip?: string | null
  phone?: string | null
} | null

export function mapAddress(a: NonNullable<GAddress>): NSettingsAddress {
  return {
    line1: a.address1?.trim() ?? '',
    line2: a.address2?.trim() ?? '',
    city: a.city?.trim() ?? '',
    province: a.province?.trim() ?? '',
    provinceCode: a.provinceCode?.trim() ?? '',
    countryCode: (a.countryCodeV2 ?? a.countryCode ?? '').trim().toUpperCase(),
    zip: a.zip?.trim() ?? '',
    phone: a.phone?.trim() ?? '',
  }
}

export async function read<T>(load: () => Promise<T>): Promise<Read<T>> {
  try {
    return { ok: true, data: await load() }
  } catch (err) {
    if (err instanceof ShopifyError) {
      return { ok: false, access: err.kind === 'scope', error: err.message }
    }
    throw err
  }
}
