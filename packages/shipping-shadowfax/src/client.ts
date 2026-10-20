import type { ShippingCapability } from '@commerce/shipping'

/**
 * What the admin shows in the browser about Shadowfax, with no adapter code behind it. The adapter
 * imports `@commerce/shipping`, whose webhook check uses `node:crypto`, so client components
 * import from `/client` instead of the package root.
 */

/** What this adapter can do today; the admin greys out anything not listed. Rates: Shadowfax's client API has no price or transit-time lookup, so checkout prices from the
 *  merchant's own zones. Pickup is scheduled by Shadowfax when the order is created. */
export const SHADOWFAX_CAPABILITIES: ShippingCapability[] = [
  'serviceability',
  'create_shipment',
  'label',
  'tracking',
  'webhook',
  'cancel',
  'ndr',
  'reverse_pickup',
]
