/** SOURCE OF TRUTH: Business, GstRegistrationView, LocationBillingView, BusinessGstView — WHAT: the shapes the Taxes & GST page reads / WHY: types only, split from registrations.ts so the rules and the shapes each stay small; registrations.ts re-exports them */
import type { business, gstRegistration, LocationCourierPickup } from '@commerce/db'
import type { LegalAddress } from './registration-schemas'

export type Business = typeof business.$inferSelect
export type GstRegistrationRow = typeof gstRegistration.$inferSelect

export type GstRegistrationView = Omit<GstRegistrationRow, 'legalAddress'> & {
  legalAddress: LegalAddress
  /** Two-letter state, e.g. 'HR'. */
  state: string
  stateName: string
  active: boolean
}

export type LocationBillingView = {
  id: string
  name: string
  line1: string | null
  line2: string | null
  city: string | null
  pincode: string | null
  /** Two-letter state, e.g. 'HR'. */
  stateCode: string | null
  stateName: string | null
  isDefault: boolean
  gstRegistrationId: string | null
  /** No active GST number in this location's state. */
  stateUnregistered: boolean
  phone: string | null
  /** Couriers collect from here (shipping/ship-from.ts); null uses Settings › Shipping. */
  courierPickup: LocationCourierPickup | null
  /** Checkout routes orders here (order/routing.ts); the default location always does. */
  fulfilsOnlineOrders: boolean
  /** Routing order among locations that ship online orders: lower ships first. */
  priority: number
}

export type BusinessGstView = {
  businesses: Business[]
  registrations: GstRegistrationView[]
  /** In routing order (`priority`), the order checkout tries them in. */
  locations: LocationBillingView[]
  /** The most parcels one order may be split into (`store.shipping.routing.maxParcels`). */
  maxParcels: number
}
