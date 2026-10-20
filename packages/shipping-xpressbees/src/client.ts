import type { ShippingCapability } from '@commerce/shipping'

/**
 * What the admin shows in the browser about Xpressbees, with no adapter code behind it. The adapter
 * imports `@commerce/shipping`, whose webhook check uses `node:crypto`, so client components
 * import from `/client` instead of the package root.
 */

/** What this adapter can do today; the admin greys out anything not listed. Pickup is requested with every booking (`request_auto_pickup`), so there is no separate
 *  pickup capability. Manifest has an adapter method (`generateManifest`) but no contract slot yet.
 *  Reverse pickup and wallet: not confirmed on this API, so left off rather than guessed at. */
export const XPRESSBEES_CAPABILITIES: ShippingCapability[] = [
  'serviceability',
  'rates',
  'create_shipment',
  'label',
  'tracking',
  'webhook',
  'cancel',
  'ndr',
]
