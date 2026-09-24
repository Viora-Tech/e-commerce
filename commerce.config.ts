import { sesPlugin } from '@commerce/notifications-ses'
import { whatsappPlugin } from '@commerce/notifications-whatsapp'
import { razorpayPlugin } from '@commerce/payments-razorpay'
import { backInStockPlugin } from '@commerce/plugin-back-in-stock'
import { gstInvoicesPlugin } from '@commerce/plugin-gst-invoices'
import { shopifyImportPlugin } from '@commerce/plugin-shopify-import'
import { defineConfig } from '@commerce/plugins'
import { delhiveryPlugin } from '@commerce/shipping-delhivery'
import { r2Plugin } from '@commerce/storage-r2'

/**
 * Plugins this deployment ships. Adding a gateway, courier, channel or bucket is one
 * import here; each store then installs it from Admin → Apps. The core
 * plugin (COD, UPI/bank transfer, demo courier, log channel, local files) is implicit.
 * See docs/plugins.md to write one.
 */
export default defineConfig({
  plugins: [
    razorpayPlugin,
    delhiveryPlugin,
    sesPlugin,
    whatsappPlugin,
    r2Plugin,
    gstInvoicesPlugin,
    shopifyImportPlugin,
    backInStockPlugin,
  ],
})
