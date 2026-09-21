import { definePlugin } from '@commerce/plugins'
import { razorpayFactory } from './razorpay'

/** Listed in commerce.config.ts; a store then installs it from Admin → Apps. */
export const razorpayPlugin = definePlugin({
  id: 'razorpay',
  name: 'Razorpay',
  version: '0.1.0',
  description: 'Cards, UPI, netbanking, wallets and EMI through Razorpay Checkout.',
  provides: { payments: [razorpayFactory] },
})
