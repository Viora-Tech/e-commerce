/** SOURCE OF TRUTH: the Delivery options app manifest — WHAT: the built-in, free "Delivery options" app (listing, access, admin pages) / WHY: the App Store catalogue, Installed apps and the admin sidebar read apps from manifests; the engine is core (`packages/core/src/shipping/delivery-options/`) because it runs inside checkout and `placeOrder`, which a plugin hook cannot reach. Free on every plan because it is absent from `APP_PRICING`. Imported by commerce.config.ts. */
import { definePlugin } from '@commerce/plugins'
import { DELIVERY_OPTIONS_APP_ID } from './config'

/**
 * Delivery options: the courier apps the store connected (Delhivery, Shiprocket, RapidShyp,
 * Blue Dart ...) become the choices at checkout, Standard and Express, each with the real
 * courier, arrival date and price for the shopper's PIN code.
 */
export const deliveryOptionsPlugin = definePlugin({
  id: DELIVERY_OPTIONS_APP_ID,
  name: 'Delivery options',
  version: '1.0.0',
  kind: 'builtin',
  category: 'shipping',
  description:
    'Show Standard and Express at checkout from the couriers you connected: the real courier, arrival date and price for each PIN code, with product rules.',
  listing: {
    tagline: 'Your connected couriers, as delivery choices at checkout.',
    highlights: [
      'Standard (cheapest) and Express (fastest) cards with the courier and arrival date',
      'Price = courier cost + your markup + insurance, rounded up to the next ₹10',
      'Product and collection rules: "Glasspads ship with Delhivery only"',
      'Express is prepaid only; Standard keeps cash on delivery',
      'Couriers down? Checkout still shows Standard at your shipping rate',
      'The order saves the exact route, and Create shipment books it',
    ],
    guide: '/merchant-guide/apps/delivery-options',
    worksWith: [
      'Delhivery, Blue Dart, DTDC and the other courier apps',
      'Shiprocket and RapidShyp (each carrier they offer is a route)',
      'Settings → Shipping rates, as the Standard backup',
      'Create shipment and bulk booking',
    ],
    keywords: [
      'delivery options',
      'express delivery',
      'shipping rates',
      'carrier calculated',
      'courier',
      'checkout',
    ],
  },
  access: {
    resources: [
      {
        resource: 'orders',
        level: 'read-write',
        why: 'Saves the route the shopper picked on the order',
      },
      {
        resource: 'products',
        level: 'read',
        why: 'Reads collections and tags for product route rules',
      },
    ],
    summary: 'shows courier delivery options at checkout',
  },
  provides: {},
  admin: {
    icon: 'Truck',
    pages: [
      { path: '', title: 'Delivery options', navLabel: 'Overview', icon: 'Truck' },
      { path: 'options', title: 'Options', navLabel: 'Options' },
      { path: 'routes', title: 'Routes', navLabel: 'Routes' },
      { path: 'rules', title: 'Product rules', navLabel: 'Product rules' },
      { path: 'options/[id]', title: 'Delivery option' },
    ],
  },
})
