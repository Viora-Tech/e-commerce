import { definePlugin } from '@commerce/plugins'
import { emiBlocks } from './blocks'
import { EMI_PAY_LATER_ID } from './offer'

/**
 * EMI & pay later: "or ₹X/month" on product pages, like Shopify's Razorpay
 * Affordability Widget app. With Razorpay chosen it loads Razorpay's official
 * widget (their hosted script, the merchant's public key id); otherwise, and
 * whenever that widget cannot show, it prints a simple no-cost EMI figure from
 * `@commerce/core/emi`. Settings live in `store.apps` (no table). Own code;
 * nothing adapted from open source (see docs/open-source-radar.md).
 */
export const emiPlugin = definePlugin({
  id: EMI_PAY_LATER_ID,
  name: 'EMI & pay later',
  version: '1.0.0',
  kind: 'builtin',
  category: 'marketing',
  description:
    'Show "or ₹X/month" on product pages so shoppers see they can pay in parts with EMI or pay later.',
  access: {
    resources: [
      { resource: 'products', level: 'read', why: 'Prices, to show the monthly amount' },
      {
        resource: 'store-settings',
        level: 'read',
        why: 'Your public Razorpay key id, for its widget',
      },
    ],
    summary: 'shows EMI prices',
    shares: [
      {
        when: 'On product pages, with Razorpay chosen',
        what: 'The product price and your public Razorpay key id, to Razorpay’s widget',
      },
    ],
  },
  provides: {},
  storefront: { blocks: emiBlocks },
  admin: {
    icon: 'CreditCard',
    pages: [{ path: '', title: 'Settings', navLabel: 'Settings', icon: 'Settings' }],
  },
})
