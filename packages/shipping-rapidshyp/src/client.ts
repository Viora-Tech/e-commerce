import type { ShippingCapability } from '@commerce/shipping'

/**
 * What the admin shows in the browser about RapidShyp, with no adapter code behind it. The
 * adapter imports `@commerce/shipping`, whose webhook check uses `node:crypto`, so a client
 * component importing the package root drags Node polyfills into the browser bundle (and their
 * `Function()` probes trip the nonce script CSP). Client components import from `/client`.
 */

/** What this adapter can do today, confirmed against RapidShyp's own docs (see the file header's
 *  verified-against-docs table). Wallet balance stays manual - no endpoint documented; webhooks are
 *  not documented either, so tracking updates come from the shared poll job, not a push. */
export const RAPIDSHYP_CAPABILITIES: ShippingCapability[] = [
  'serviceability',
  'rates',
  'create_shipment',
  'label',
  'tracking',
  'cancel',
  'ndr',
  'reverse_pickup',
]
