import { definePlugin } from '@commerce/plugins'
import { razorpayFactory } from './razorpay'
import { razorpayUpiFactory } from './upi-qr'

/** Listed in commerce.config.ts; a store then installs it from Admin → Apps. */
export const razorpayPlugin = definePlugin({
  id: 'razorpay',
  name: 'Razorpay',
  version: '0.1.0',
  kind: 'connection',
  category: 'payments',
  company: 'Razorpay',
  description:
    'Cards, UPI, netbanking, wallets and EMI through Razorpay Checkout, plus UPI QR payments confirmed automatically.',
  provides: { payments: [razorpayFactory, razorpayUpiFactory] },
})
