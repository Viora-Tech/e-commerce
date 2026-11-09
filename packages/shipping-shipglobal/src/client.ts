import type { ShippingCapability } from '@commerce/shipping'

/**
 * What the admin shows in the browser about ShipGlobal, with no adapter code behind it. The
 * adapter imports `@commerce/shipping`, whose webhook check uses `node:crypto`, so client
 * components import from `/client` (same split as the other courier apps).
 */

/**
 * ShipGlobal's vendor API ("ApiV1 ShipGlobal Vendor - Production",
 * https://developer.docs.shipglobal.in/, published 2026-11-03). The paths start with `/apiv1`.
 * The docs keep the host in an unpublished Postman variable; app.shipglobal.in is the one that
 * answers `/apiv1/rates/calculate` with ShipGlobal's own EA_401 JSON (checked 2026-11-10).
 * The docs name no sandbox host, so there is no Test/Live switch.
 */
export const SHIPGLOBAL_API_URL = 'https://app.shipglobal.in'

/** ShipGlobal's public tracker. It takes the number in a form; no URL format is documented. */
export const SHIPGLOBAL_TRACKING_PAGE = 'https://shipglobal.in/tracking/'

/** Where the merchant signs in to ShipGlobal (Settings › API holds the API login). */
export const SHIPGLOBAL_DASHBOARD_URL = 'https://v2.app.shipglobal.in/auth/login'

/**
 * The services the docs' rate sample lists, by the title ShipGlobal itself uses. The rate
 * table books whatever title the live rates return; this list is only the Connect page's
 * default for a booking made without a rate pick.
 */
export const SHIPGLOBAL_SERVICES = [
  { code: 'ShipGlobal Direct', label: 'ShipGlobal Direct' },
  { code: 'ShipGlobal First Class', label: 'ShipGlobal First Class' },
  { code: 'ShipGlobal Premium', label: 'ShipGlobal Premium' },
  { code: 'UPS Promotional', label: 'UPS Promotional' },
  { code: 'UPS', label: 'UPS' },
  { code: 'Fedex', label: 'FedEx' },
] as const

export type ShipglobalServiceCode = (typeof SHIPGLOBAL_SERVICES)[number]['code']

export const SHIPGLOBAL_DEFAULT_SERVICE: ShipglobalServiceCode = 'ShipGlobal Direct'

/**
 * What this adapter does with the vendor API: live rates, booking with the paid label,
 * tracking and cancel with refund. No pickup or webhook call is documented.
 */
export const SHIPGLOBAL_CAPABILITIES: ShippingCapability[] = [
  'serviceability',
  'rates',
  'create_shipment',
  'label',
  'tracking',
  'cancel',
  'international',
]
