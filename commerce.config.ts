import { automationsPlugin } from '@commerce/core/automations-app'
import { sesPlugin } from '@commerce/notifications-ses'
import { whatsappPlugin } from '@commerce/notifications-whatsapp'
import { cashfreePlugin } from '@commerce/payments-cashfree'
import { decentroPlugin } from '@commerce/payments-decentro'
import { razorpayPlugin } from '@commerce/payments-razorpay'
import { affiliatesPlugin } from '@commerce/plugin-affiliates'
import { backInStockPlugin } from '@commerce/plugin-back-in-stock'
import { chatwootPlugin } from '@commerce/plugin-chatwoot'
import { emiPlugin } from '@commerce/plugin-emi'
import { formsPlugin } from '@commerce/plugin-forms'
import { growthbookPlugin } from '@commerce/plugin-growthbook'
import { gstInvoicesPlugin } from '@commerce/plugin-gst-invoices'
import { meilisearchPlugin } from '@commerce/plugin-meilisearch'
import { reviewsPlugin } from '@commerce/plugin-reviews'
import { searchPlugin } from '@commerce/plugin-search'
import { searchConsolePlugin } from '@commerce/plugin-search-console'
import { shopifyImportPlugin } from '@commerce/plugin-shopify-import'
import { umamiPlugin } from '@commerce/plugin-umami'
import { defineConfig } from '@commerce/plugins'
import { bluedartPlugin } from '@commerce/shipping-bluedart'
import { delhiveryPlugin } from '@commerce/shipping-delhivery'
import { dhlExpressPlugin } from '@commerce/shipping-dhl-express'
import { dtdcPlugin } from '@commerce/shipping-dtdc'
import { ekartPlugin } from '@commerce/shipping-ekart'
import { fedexPlugin } from '@commerce/shipping-fedex'
import { indiaPostPlugin } from '@commerce/shipping-indiapost'
import { rapidshypPlugin } from '@commerce/shipping-rapidshyp'
import { shadowfaxPlugin } from '@commerce/shipping-shadowfax'
import { shiprocketPlugin } from '@commerce/shipping-shiprocket'
import { xpressbeesPlugin } from '@commerce/shipping-xpressbees'
import { r2Plugin } from '@commerce/storage-r2'
import { s3Plugin } from '@commerce/storage-s3'

/**
 * Plugins this deployment ships. Adding a gateway, courier, channel or bucket is one
 * import here; each store then installs it from Admin → Apps. The core
 * plugin (COD, UPI/bank transfer, demo courier, log channel, local files) is implicit.
 * See docs/plugins.md to write one.
 */
export default defineConfig({
  plugins: [
    razorpayPlugin,
    cashfreePlugin,
    decentroPlugin,
    delhiveryPlugin,
    shiprocketPlugin,
    rapidshypPlugin,
    bluedartPlugin,
    dtdcPlugin,
    indiaPostPlugin,
    xpressbeesPlugin,
    ekartPlugin,
    shadowfaxPlugin,
    dhlExpressPlugin,
    fedexPlugin,
    sesPlugin,
    whatsappPlugin,
    r2Plugin,
    s3Plugin,
    gstInvoicesPlugin,
    shopifyImportPlugin,
    backInStockPlugin,
    emiPlugin,
    formsPlugin,
    reviewsPlugin,
    umamiPlugin,
    searchConsolePlugin,
    meilisearchPlugin,
    chatwootPlugin,
    growthbookPlugin,
    searchPlugin,
    affiliatesPlugin,
    automationsPlugin,
  ],
})
