import type { TranslationPair } from '@/lib/i18n'
import account from './account'
import ai from './ai'
import assistant from './assistant'
import bugReport from './bug-report'
import businessGst from './business-gst'
import checkoutSettings from './checkout-settings'
import common from './common'
import dates from './dates'
import gstInvoices from './gst-invoices'
import home from './home'
import layout from './layout'
import metaobjects from './metaobjects'
import navigation from './navigation'
import onboarding from './onboarding'
import orders from './orders'
import payments from './payments'
import paymentsSetup from './payments-setup'
import products from './products'
import reviews from './reviews'
import settings from './settings'
import shipping from './shipping'
import shippingRates from './shipping-rates'
import shopifyImport from './shopify-import'
import staffInvites from './staff-invites'
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
  ...gstInvoices,
  ...home,
  ...layout,
  ...metaobjects,
  ...navigation,
  ...onboarding,
  ...orders,
  ...payments,
  ...paymentsSetup,
  ...products,
  ...reviews,
  ...settings,
  ...shipping,
  ...shippingRates,
  ...shopifyImport,
  ...staffInvites,
  ...storeData,
  ...table,
  ...themeImport,
]
