import type { ShippingCapability } from '@commerce/shipping'

/**
 * What the admin shows in the browser about DTDC, with no adapter code behind it. The adapter
 * imports `@commerce/shipping`, whose webhook check uses `node:crypto`, so a client component
 * importing the package root drags Node polyfills into the browser bundle. Client components
 * import from `/client`.
 */

/** DTDC's booking API runs on Shipsy. Production, and the demo host for test keys. */
export const DTDC_BASE_URL = 'https://dtdcapi.shipsy.io'
export const DTDC_DEMO_URL = 'https://demodashboardapi.shipsy.in'

/** What this adapter can do. Rates: no price API in DTDC's integration kit, checkout prices from
 *  the merchant's zones. Pickup: DTDC collects booked consignments on the account's daily
 *  pickup, there is no pickup call. Webhook: DTDC sets up status pushes per account on request,
 *  so tracking comes from the shared poll job. */
export const DTDC_CAPABILITIES: ShippingCapability[] = [
  'serviceability',
  'create_shipment',
  'label',
  'tracking',
  'cancel',
]
