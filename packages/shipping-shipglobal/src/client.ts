import type { ShippingCapability } from '@commerce/shipping'

/**
 * What the admin shows in the browser about ShipGlobal, with no adapter code behind it. The
 * adapter imports `@commerce/shipping`, whose webhook check uses `node:crypto`, so client
 * components import from `/client` (same split as the other courier apps).
 */

/**
 * ShipGlobal's Label Generation API, the only API ShipGlobal publishes
 * (https://labels.shipglobal.in/api-docs.php, read 2026-10-31). One host: the docs name no
 * separate sandbox, so there is no Test/Live switch.
 * VERIFY: that a merchant account from app.shipglobal.in signs in here, or which host it uses.
 */
export const SHIPGLOBAL_API_URL = 'https://labels.shipglobal.in/api/v1'

/** ShipGlobal's public tracker. It takes the number in a form; no URL format is documented. */
export const SHIPGLOBAL_TRACKING_PAGE = 'https://shipglobal.in/tracking/'

/** Where the merchant signs in to ShipGlobal (Settings › API holds the API login). */
export const SHIPGLOBAL_DASHBOARD_URL = 'https://v2.app.shipglobal.in/auth/login'

/**
 * The service codes in the docs' "Supported Services" table. USPS and UPS deliver in the US
 * only, split at 5 kg (USPS up to 5000 g, UPS above); the rest list no rule.
 */
export const SHIPGLOBAL_SERVICES = [
  { code: 'DHLECS', label: 'DHL eCommerce' },
  { code: 'DPD', label: 'DPD' },
  { code: 'UNIUNI', label: 'UniUni' },
  { code: 'UBI', label: 'UBI' },
  { code: 'VIPPARCEL', label: 'VipParcel' },
  { code: 'USPS', label: 'USPS (US, up to 5 kg) / UPS (US, above 5 kg)' },
] as const

export type ShipglobalServiceCode = (typeof SHIPGLOBAL_SERVICES)[number]['code'] | 'UPS'

export const SHIPGLOBAL_DEFAULT_SERVICE: ShipglobalServiceCode = 'DHLECS'

/**
 * What this adapter does. The published API books an order and returns its label; it has no
 * rate, tracking, cancel or pickup call, so those are not claimed: the rate table shows
 * ShipGlobal as "rate on booking", the merchant moves each parcel's status on the app page,
 * and cancelling happens in ShipGlobal's own panel.
 */
export const SHIPGLOBAL_CAPABILITIES: ShippingCapability[] = [
  'serviceability',
  'create_shipment',
  'label',
  'international',
]
