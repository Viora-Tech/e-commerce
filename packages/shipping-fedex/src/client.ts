import type { ShippingCapability } from '@commerce/shipping'

/**
 * What the admin shows in the browser about FedEx, with no adapter code behind it. The adapter
 * imports `@commerce/shipping`, whose webhook check uses `node:crypto`, so client components
 * import from `/client` (same split as the other courier apps).
 */

/** FedEx REST API hosts. The sandbox needs the sandbox project's own API key and secret. */
export const FEDEX_TEST_URL = 'https://apis-sandbox.fedex.com'
export const FEDEX_LIVE_URL = 'https://apis.fedex.com'

/** What this adapter does (FedEx REST APIs: OAuth, Rates and Transit Times, Ship, Pickup
 *  Request, Basic Integrated Visibility tracking). A pickup is requested right after each
 *  booking, so there is no separate "Schedule pickup". Tracking webhooks need a FedEx-approved
 *  project, so tracking comes from the shared poll job. */
export const FEDEX_CAPABILITIES: ShippingCapability[] = [
  'serviceability',
  'rates',
  'create_shipment',
  'label',
  'tracking',
  'cancel',
  'international',
]
