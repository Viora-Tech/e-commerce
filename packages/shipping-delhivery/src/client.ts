import type { ShippingCapability } from '@commerce/shipping'

/**
 * What the admin shows in the browser about Delhivery, with no adapter code behind it. The
 * adapter imports `@commerce/shipping`, whose webhook check uses `node:crypto`, so a client
 * component importing the package root drags Node polyfills into the browser bundle (and their
 * `Function()` probes trip the nonce script CSP). Client components import from `/client`.
 */

/** Production. Staging is https://staging-express.delhivery.com for test keys. */
export const DELHIVERY_BASE_URL = 'https://track.delhivery.com'
export const DELHIVERY_STAGING_URL = 'https://staging-express.delhivery.com'

/** What this adapter can do today; the admin greys out anything not listed. Rates: Delhivery has
 *  no quote endpoint, checkout prices shipping from the merchant's own zones instead. Manifest and
 *  wallet: no confirmed public API (see delhivery.ts and the courier app's wallet card), so both are
 *  left off rather than guessed at. */
export const DELHIVERY_CAPABILITIES: ShippingCapability[] = [
  'serviceability',
  'rates',
  'create_shipment',
  'label',
  'pickup',
  'tracking',
  'webhook',
  'cancel',
  'ndr',
  'reverse_pickup',
]
