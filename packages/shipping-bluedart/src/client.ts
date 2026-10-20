import type { ShippingCapability } from '@commerce/shipping'

/**
 * What the admin shows in the browser about Blue Dart, with no adapter code behind it. The
 * adapter imports `@commerce/shipping`, whose webhook check uses `node:crypto`, so a client
 * component importing the package root drags Node polyfills into the browser bundle. Client
 * components import from `/client`.
 */

/** Blue Dart's API Gateway (developer.dhl.com, "Blue Dart" APIs). Every path sits under it. */
export const BLUEDART_BASE_URL = 'https://apigateway.bluedart.com'
/** The sandbox the gateway's v1.0.1 release notes added; test keys only work here. */
export const BLUEDART_SANDBOX_URL = 'https://apigateway-sandbox.bluedart.com'

/** What this adapter can do. Rates: the gateway has no price API, checkout prices from the
 *  merchant's zones. Webhook: Blue Dart's push API is set up per account by Blue Dart, not
 *  self-serve, so tracking comes from the shared poll job. NDR: the Alt-Instruction API's
 *  request shape is behind the portal login, so failed deliveries are shown, not acted on. */
export const BLUEDART_CAPABILITIES: ShippingCapability[] = [
  'serviceability',
  'create_shipment',
  'label',
  'pickup',
  'tracking',
  'cancel',
]
