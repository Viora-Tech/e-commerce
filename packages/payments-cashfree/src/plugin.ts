import { definePlugin } from '@commerce/plugins'
import { cashfreeFactory } from './cashfree'

/** Listed in commerce.config.ts; a store then installs it from Admin → Apps. */
export const cashfreePlugin = definePlugin({
  id: 'cashfree',
  name: 'Cashfree',
  version: '0.1.0',
  kind: 'connection',
  category: 'payments',
  company: 'Cashfree Payments',
  description: 'UPI, cards, netbanking, wallets and pay later through Cashfree Checkout.',
  provides: { payments: [cashfreeFactory] },
  admin: {
    icon: 'CreditCard',
    pages: [
      { path: '', title: 'Cashfree', navLabel: 'Overview', icon: 'CreditCard' },
      { path: 'connect', title: 'Connect Cashfree', navLabel: 'Connect', icon: 'Settings' },
    ],
  },
})
