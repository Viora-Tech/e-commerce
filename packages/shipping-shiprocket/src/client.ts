import type { ShippingCapability } from '@commerce/shipping'

/**
 * What the admin shows in the browser about Shiprocket, with no adapter code behind it. The
 * adapter imports `@commerce/shipping`, whose webhook check uses `node:crypto`, so a client
 * component importing the package root drags Node polyfills into the browser bundle (and their
 * `Function()` probes trip the nonce script CSP). Client components import from `/client`.
 */

/** What this adapter can do today. Manifest and insurance are left off: manifest generation is
 *  implemented in code (`/manifests/generate`) but not exposed as a capability until the workspace
 *  wires a "generate manifest" action for it; insurance has no endpoint confirmed. */
export const SHIPROCKET_CAPABILITIES: ShippingCapability[] = [
  'serviceability',
  'rates',
  'create_shipment',
  'label',
  'tracking',
  'webhook',
  'ndr',
  'wallet',
  'reverse_pickup',
]
