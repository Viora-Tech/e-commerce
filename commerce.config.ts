import { sesPlugin } from '@commerce/notifications-ses'
import { whatsappPlugin } from '@commerce/notifications-whatsapp'
import { razorpayPlugin } from '@commerce/payments-razorpay'
import { defineConfig } from '@commerce/plugins'
import { delhiveryPlugin } from '@commerce/shipping-delhivery'

/**
 * Plugins this deployment ships. Adding a gateway, courier or channel is one
 * import here; each store then installs it from Admin → Apps. The core
 * plugin (COD, UPI/bank transfer, demo courier, log channel) is implicit.
 * See docs/plugins.md to write one.
 */
export default defineConfig({
  plugins: [razorpayPlugin, delhiveryPlugin, sesPlugin, whatsappPlugin],
})
