/** SOURCE OF TRUTH: app logos — WHAT: which apps show a real third-party logo, and its file / WHY: the admin and the App Store site draw the same logo for an app */
/**
 * Real third-party logos, by app id (`@commerce/core/app-logos`, pure). Each file lives under
 * `public/app-logos` in the admin and on the App Store site (trademarks of their owners); the
 * `app-catalogue` sweep checks both. Apps not listed draw a tile instead.
 */
export const APP_LOGOS: Readonly<Record<string, string>> = {
  bluedart: '/app-logos/bluedart.svg',
  cashfree: '/app-logos/cashfree.png',
  chatwoot: '/app-logos/chatwoot.svg',
  decentro: '/app-logos/decentro.png',
  delhivery: '/app-logos/delhivery.png',
  'dhl-express': '/app-logos/dhl-express.svg',
  dtdc: '/app-logos/dtdc.png',
  ekart: '/app-logos/ekart.png',
  fedex: '/app-logos/fedex.svg',
  'google-search-console': '/app-logos/google-search-console.svg',
  growthbook: '/app-logos/growthbook.png',
  'india-post': '/app-logos/india-post.png',
  meilisearch: '/app-logos/meilisearch.svg',
  r2: '/app-logos/r2.svg',
  rapidshyp: '/app-logos/rapidshyp.png',
  razorpay: '/app-logos/razorpay.svg',
  s3: '/app-logos/s3.svg',
  ses: '/app-logos/ses.svg',
  shadowfax: '/app-logos/shadowfax.png',
  shiprocket: '/app-logos/shiprocket.png',
  umami: '/app-logos/umami.svg',
  whatsapp: '/app-logos/whatsapp.svg',
  xpressbees: '/app-logos/xpressbees.png',
}
