import { sesPlugin } from '@commerce/notifications-ses'
import { whatsappPlugin } from '@commerce/notifications-whatsapp'
import { cashfreePlugin } from '@commerce/payments-cashfree'
import { decentroPlugin } from '@commerce/payments-decentro'
import { razorpayPlugin } from '@commerce/payments-razorpay'
import { backInStockPlugin } from '@commerce/plugin-back-in-stock'
import { emiPlugin } from '@commerce/plugin-emi'
import { formsPlugin } from '@commerce/plugin-forms'
import { gstInvoicesPlugin } from '@commerce/plugin-gst-invoices'
import { reviewsPlugin } from '@commerce/plugin-reviews'
import { searchConsolePlugin } from '@commerce/plugin-search-console'
import { shopifyImportPlugin } from '@commerce/plugin-shopify-import'
import { umamiPlugin } from '@commerce/plugin-umami'
import { defineConfig } from '@commerce/plugins'
import { delhiveryPlugin } from '@commerce/shipping-delhivery'
import { ekartPlugin } from '@commerce/shipping-ekart'
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
    xpressbeesPlugin,
    ekartPlugin,
    shadowfaxPlugin,
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
  ],
})
