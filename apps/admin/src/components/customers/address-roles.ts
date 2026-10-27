import type { CustomerAddressRow } from './customer-detail-types'

/** What a saved address is used for on new orders; null keeps it in the book only. */
export type AddressRole = 'shipping' | 'billing' | 'both'

export const ADDRESS_ROLES: readonly AddressRole[] = ['shipping', 'billing', 'both']

type RoleFlags = Pick<CustomerAddressRow, 'isDefault' | 'isDefaultBilling'>

/** The role an address plays now, read from its two default flags. */
export function roleOf(a: RoleFlags): AddressRole | null {
  if (a.isDefault && a.isDefaultBilling) return 'both'
  if (a.isDefault) return 'shipping'
  if (a.isDefaultBilling) return 'billing'
  return null
}

/**
 * The flags the API takes for a role. Billing-only sends `isDefault: false`, which the API
 * ignores for the current shipping address (another one has to take it over) and overrides for
 * a customer's first address (the first one always ships).
 */
export function flagsFor(role: AddressRole | null): RoleFlags {
  return {
    isDefault: role === 'shipping' || role === 'both',
    isDefaultBilling: role === 'billing' || role === 'both',
  }
}

export type AddressBook = {
  shipping: CustomerAddressRow | null
  /** A separate billing address; null means billing is the same as shipping. */
  billing: CustomerAddressRow | null
  others: CustomerAddressRow[]
}

/** Split the book into the shipping address, a separate billing one, and the rest. */
export function splitAddressBook(rows: CustomerAddressRow[]): AddressBook {
  const shipping = rows.find((r) => r.isDefault) ?? null
  const billing = rows.find((r) => r.isDefaultBilling && !r.isDefault) ?? null
  const others = rows.filter((r) => r !== shipping && r !== billing)
  return { shipping, billing, others }
}
