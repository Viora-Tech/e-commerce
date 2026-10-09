import type { TranslationPair } from '@/lib/i18n'
import account from './account'
import ai from './ai'
import assistant from './assistant'
import bugReport from './bug-report'
import businessGst from './business-gst'
import checkoutSettings from './checkout-settings'
import collections from './collections'
import common from './common'
import dates from './dates'
import domains from './domains'
import gstInvoices from './gst-invoices'
import home from './home'
import inventory from './inventory'
import layout from './layout'
import login from './login'
import metaobjects from './metaobjects'
import navigation from './navigation'
import onboarding from './onboarding'
import orders from './orders'
import payments from './payments'
import paymentsSetup from './payments-setup'
import products from './products'
import reviews from './reviews'
import selectProducts from './select-products'
import settings from './settings'
import shipping from './shipping'
import shippingRates from './shipping-rates'
import shopifyImport from './shopify-import'
import staffInvites from './staff-invites'
import states from './states'
import storeData from './store-data'
import table from './table'
import themeImport from './theme-import'

/**
 * Every Hindi translation, as [English export, Hindi overlay] pairs. A `data/<feature>.ts`
 * with no entry here stays English. Add a feature: write `data/hi/<feature>.ts` (default
 * export: an array of `translation(...)` pairs) and spread it in below.
 */
export const hindiCopy: readonly TranslationPair[] = [
  ...account,
  ...ai,
  ...assistant,
  ...bugReport,
  ...businessGst,
  ...checkoutSettings,
  ...common,
  ...dates,
  ...domains,
  ...gstInvoices,
  ...home,
  ...layout,
  ...login,
  ...metaobjects,
  ...navigation,
  ...onboarding,
  ...orders,
  ...payments,
  ...paymentsSetup,
  ...collections,
  ...inventory,
  ...products,
  ...selectProducts,
  ...reviews,
  ...settings,
  ...shipping,
  ...shippingRates,
  ...shopifyImport,
  ...staffInvites,
  ...states,
  ...storeData,
  ...table,
  ...themeImport,
]
