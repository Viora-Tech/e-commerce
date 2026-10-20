import type { ShippingCapability } from '@commerce/shipping'

/**
 * What the admin shows in the browser about DHL Express, with no adapter code behind it. The
 * adapter imports `@commerce/shipping`, whose webhook check uses `node:crypto`, so client
 * components import from `/client` (same split as the other courier apps).
 */

/** MyDHL API hosts. Test is DHL's sandbox (500 calls a day, fixed tracking numbers only). */
export const DHL_EXPRESS_TEST_URL = 'https://express.api.dhl.com/mydhlapi/test'
export const DHL_EXPRESS_LIVE_URL = 'https://express.api.dhl.com/mydhlapi'

/** What this adapter does, each call checked against DHL's MyDHL API 3.3.1 OpenAPI file. A pickup
 *  is requested with each shipment (the create call's `pickup.isRequested`), so there is no
 *  separate "Schedule pickup"; cancelling cancels that pickup. No webhook: DHL pushes none to
 *  MyDHL API users, so tracking comes from the shared poll job. */
export const DHL_EXPRESS_CAPABILITIES: ShippingCapability[] = [
  'serviceability',
  'rates',
  'create_shipment',
  'label',
  'tracking',
  'cancel',
  'international',
]
