import type { PolicyType } from '@commerce/core/policies'
import type { HealthArea, HealthSeverity } from '@commerce/core/store-health'

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** Settings → Store health, the Home card and the Shopify import summary. */
export const storeHealthContent = {
  title: 'Store health',
  intro:
    'Setups that will break or hurt checkout and orders, worst first. Each one links to where you fix it.',
  recheck: 'Check again',
  checked: (when: string) => `Checked ${when}`,
  loadFailed: 'Could not check your store. Try again in a moment.',
  allGood: {
    title: 'Nothing to fix',
    body: 'Shipping, payments, products and store details all look right.',
  },
  severity: {
    blocks_checkout: 'Blocks checkout',
    should_fix: 'Should fix',
    nice_to_have: 'Nice to have',
  } satisfies Record<HealthSeverity, string>,
  severityHelp: {
    blocks_checkout: 'Some shoppers cannot place an order until this is fixed.',
    should_fix: 'Orders go through, but something goes wrong after or costs you money.',
    nice_to_have: 'Small things that make your store better.',
  } satisfies Record<HealthSeverity, string>,
  areas: {
    shipping: 'Shipping',
    payments: 'Payments',
    products: 'Products',
    store: 'Store',
  } satisfies Record<HealthArea, string>,
  policyNames: {
    'refund-policy': 'refund',
    'privacy-policy': 'privacy',
    'terms-of-service': 'terms of service',
    'shipping-policy': 'shipping',
    'contact-information': 'contact information',
  } satisfies Record<PolicyType, string>,
  issues: {
    zone_no_rates: {
      title: (zone: string) => `Shipping zone "${zone}" has no rates`,
      body: 'Checkout skips it, so it does nothing. Add a rate or delete the zone.',
      fix: 'Open zone',
    },
    zones_overlap: {
      title: (zones: string) => `Zones cover the same places: ${zones}`,
      body: 'Only the first one with a rate is used, which makes prices hard to predict. Keep one.',
      fix: 'Open shipping',
    },
    states_uncovered: {
      title: (n: number) => `Shoppers in ${plural(n, 'state', 'states')} cannot check out`,
      body: (states: string) => `No shipping zone with a rate covers ${states}.`,
      fix: 'Add a zone',
    },
    no_origin_pincode: {
      title: 'No PIN code to ship from',
      body: 'Couriers need it to collect parcels and to estimate delivery dates.',
      fix: 'Add PIN code',
    },
    no_courier: {
      title: 'No courier connected',
      body: 'Without one you book every parcel and type every tracking number yourself.',
      fix: 'Browse couriers',
    },
    variants_no_weight: {
      title: (variants: number) => `${plural(variants, 'variant has', 'variants have')} no weight`,
      body: (products: number) =>
        `Across ${plural(products, 'active product', 'active products')}. Weight-based rates and courier charges come out wrong.`,
      fix: 'Show products',
    },
    products_no_price: {
      title: (products: number) =>
        `${plural(products, 'active product is', 'active products are')} priced at ₹0`,
      body: 'Shoppers can order them for free. If that is not meant, set a price or hide the variant on the store.',
      fix: 'Show products',
    },
    products_no_image: {
      title: (products: number) =>
        `${plural(products, 'active product has', 'active products have')} no image`,
      body: 'Products with photos sell far better and look right in your store and ads.',
      fix: 'Show products',
    },
    no_payment_method: {
      title: 'No way to pay at checkout',
      body: 'Every payment method is switched off, so no one can place an order.',
      fix: 'Open payments',
    },
    no_online_payment: {
      title: 'Customers can only pay cash on delivery',
      body: 'Connect a payment gateway so shoppers can pay by UPI and cards. Prepaid orders get returned less.',
      fix: 'Set up payments',
    },
    gateway_test_mode: {
      title: (gateway: string) => `${gateway} is still in Test mode`,
      body: 'Shoppers’ online payments are not real and those orders are hidden as tests. Switch to Live.',
      fix: 'Go live',
    },
    webhook_missing: {
      title: (gateway: string) => `No updates from ${gateway} yet`,
      body: (paid: boolean) =>
        paid
          ? 'Payments came in but the gateway never told us. Refunds and late payments will not update your orders.'
          : 'We have not received a webhook yet. Check it is set up so payments update your orders.',
      fix: 'Check webhook',
    },
    policies_missing: {
      title: (n: number) => `${plural(n, 'policy is', 'policies are')} not published`,
      body: (names: string) =>
        `Missing: ${names}. Indian law expects them, and payment gateways check for them.`,
      fix: 'Add policies',
    },
    policies_unfilled: {
      title: (n: number) =>
        `${plural(n, 'live policy shows', 'live policies show')} blanks like [email address]`,
      body: (names: string) =>
        `${names}. Shoppers see the gaps. Add your details in Store details, then open the policy and fill them in.`,
      fix: 'Fix policies',
    },
    sender_unverified: {
      title: (email: string) => `${email} is not verified`,
      body: (failed: boolean) =>
        failed
          ? 'Verification failed. Order emails go from our address until the DNS records are fixed.'
          : 'Add the DNS records we gave you. Order emails go from our address until then.',
      fix: 'Open email settings',
    },
    no_sender_email: {
      title: 'Order emails go from our address',
      body: 'Send them from your own domain so customers recognise you and fewer land in spam.',
      fix: 'Add your email',
    },
  },
  /** Home: the count of problems by severity. */
  card: {
    title: 'Store health',
    allGood: 'Nothing to fix. Checkout, shipping and payments look right.',
    open: 'See what to fix',
  },
  /** The Shopify import's summary, once an import finishes. */
  importSummary: {
    title: 'Store health after this import',
    intro: 'Things the import left that will break or hurt checkout. Fix them before you go live.',
    allGood: 'Nothing to fix. Checkout, shipping and payments look right.',
    more: (n: number) => `${plural(n, 'more thing', 'more things')} to fix`,
    open: 'See all',
  },
}
