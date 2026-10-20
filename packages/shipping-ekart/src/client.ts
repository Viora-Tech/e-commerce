import type { ShippingCapability } from '@commerce/shipping'

/**
 * What the admin shows in the browser about Ekart, with no adapter code behind it. The adapter
 * imports `@commerce/shipping`, whose webhook check uses `node:crypto`, so client components
 * import from `/client` instead of the package root.
 */

/** What this adapter can do today; the admin greys out anything not listed. Label: Ekart answers the label call with the PDF bytes, not a link, and the admin opens labels
 *  by link, so `label` stays off until a label proxy route exists (the adapter's `downloadLabel`
 *  is ready for it). Pickup is set by `preferred_dispatch_date` on the booking, not a call. */
export const EKART_CAPABILITIES: ShippingCapability[] = [
  'serviceability',
  'rates',
  'create_shipment',
  'tracking',
  'webhook',
  'cancel',
  'ndr',
  'reverse_pickup',
]
