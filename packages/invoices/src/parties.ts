import { gstState } from '@commerce/core/gstin'
import type { SellerSettings } from './settings'
import type { Party, Place } from './snapshot'

/** A state as documents print it, from a two-letter code or a full name. */
export function placeOf(state: string | null | undefined): Place | null {
  const s = gstState(state ?? '')
  return s ? { code: s.code, gstCode: s.gstCode, name: s.name } : null
}

export function sellerParty(seller: SellerSettings, fallbackName: string): Party {
  const place = placeOf(seller.stateCode)
  const cityLine = [seller.city, place?.name, seller.pincode].filter(Boolean).join(', ')
  return {
    name: seller.legalName || fallbackName,
    gstin: seller.gstin || null,
    address: [seller.line1, seller.line2, cityLine].filter(Boolean),
    state: place,
    email: seller.email || null,
    phone: seller.phone || null,
  }
}

export type AddressInput = {
  name: string | null
  line1: string | null
  line2?: string | null | undefined
  city: string | null
  state: string | null
  pincode: string | null
  phone?: string | null | undefined
  email?: string | null | undefined
  gstin?: string | null | undefined
}

export function addressParty(a: AddressInput): Party {
  const place = placeOf(a.state)
  const cityLine = [a.city, place?.name ?? a.state, a.pincode].filter(Boolean).join(', ')
  return {
    name: a.name?.trim() || 'Customer',
    gstin: a.gstin?.trim() || null,
    address: [a.line1, a.line2, cityLine].filter((l): l is string => Boolean(l)),
    state: place,
    email: a.email ?? null,
    phone: a.phone ?? null,
  }
}
