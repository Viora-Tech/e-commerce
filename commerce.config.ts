import { sesPlugin } from '@commerce/notifications-ses'
import { whatsappPlugin } from '@commerce/notifications-whatsapp'
import { cashfreePlugin } from '@commerce/payments-cashfree'
import { decentroPlugin } from '@commerce/payments-decentro'
import { razorpayPlugin } from '@commerce/payments-razorpay'
import { backInStockPlugin } from '@commerce/plugin-back-in-stock'
import { gstInvoicesPlugin } from '@commerce/plugin-gst-invoices'
import { shopifyImportPlugin } from '@commerce/plugin-shopify-import'
import { defineConfig } from '@commerce/plugins'
import { delhiveryPlugin } from '@commerce/shipping-delhivery'
import { rapidshypPlugin } from '@commerce/shipping-rapidshyp'
import { shiprocketPlugin } from '@commerce/shipping-shiprocket'
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
    sesPlugin,
    whatsappPlugin,
    r2Plugin,
    s3Plugin,
    gstInvoicesPlugin,
    shopifyImportPlugin,
    backInStockPlugin,
  ],
})
