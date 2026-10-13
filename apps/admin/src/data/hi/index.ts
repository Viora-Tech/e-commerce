import type { TranslationPair } from '@/lib/i18n'
import abandonedDetail from './abandoned-detail'
import account from './account'
import ai from './ai'
import analytics from './analytics'
import apps from './apps'
import assistant from './assistant'
import backgroundWork from './background-work'
import bugReport from './bug-report'
import bulkEdit from './bulk-edit'
import businessGst from './business-gst'
import checkoutSettings from './checkout-settings'
import collections from './collections'
import commandPalette from './command-palette'
import common from './common'
import content from './content'
import contentBlog from './content-blog'
import contentFiles from './content-files'
import createShipment from './create-shipment'
import customers from './customers'
import customizeMedia from './customize-media'
import dates from './dates'
import discounts from './discounts'
import domains from './domains'
import growth from './growth'
import gstInvoices from './gst-invoices'
import home from './home'
import inventory from './inventory'
import layout from './layout'
import login from './login'
import marketingAutomations from './marketing-automations'
import marketingCampaigns from './marketing-campaigns'
import metaobjects from './metaobjects'
import navigation from './navigation'
import notifications from './notifications'
import onboarding from './onboarding'
import orderCards from './order-cards'
import orders from './orders'
import payments from './payments'
import paymentsSetup from './payments-setup'
import products from './products'
import profitCosts from './profit-costs'
import purchaseDocuments from './purchase-documents'
import purchasing from './purchasing'
import reviews from './reviews'
import selectProducts from './select-products'
import settings from './settings'
import shipping from './shipping'
import shippingRates from './shipping-rates'
import shopifyImport from './shopify-import'
import shopifyImportFiles from './shopify-import-files'
import shopifyImportRun from './shopify-import-run'
import shopifyImportSettings from './shopify-import-settings'
import staff from './staff'
import staffInvites from './staff-invites'
import states from './states'
import storageWarning from './storage-warning'
import storeData from './store-data'
import table from './table'
import themeImport from './theme-import'
import themes from './themes'
import umami from './umami'

/**
 * Every Hindi translation, as [English export, Hindi overlay] pairs. A `data/<feature>.ts`
 * with no entry here stays English. Add a feature: write `data/hi/<feature>.ts` (default
 * export: an array of `translation(...)` pairs) and spread it in below.
 */
export const hindiCopy: readonly TranslationPair[] = [
  ...account,
  ...apps,
  ...abandonedDetail,
  ...ai,
  ...assistant,
  ...backgroundWork,
  ...bugReport,
  ...bulkEdit,
  ...businessGst,
  ...checkoutSettings,
  ...common,
  ...content,
  ...contentBlog,
  ...contentFiles,
  ...createShipment,
  ...customers,
  ...customizeMedia,
  ...dates,
  ...domains,
  ...analytics,
  ...discounts,
  ...growth,
  ...gstInvoices,
  ...home,
  ...layout,
  ...marketingAutomations,
  ...marketingCampaigns,
  ...login,
  ...metaobjects,
  ...navigation,
  ...onboarding,
  ...orderCards,
  ...shopifyImportFiles,
  ...shopifyImportRun,
  ...shopifyImportSettings,
  ...orders,
  ...payments,
  ...paymentsSetup,
  ...collections,
  ...commandPalette,
  ...inventory,
  ...products,
  ...purchaseDocuments,
  ...profitCosts,
  ...purchasing,
  ...selectProducts,
  ...reviews,
  ...settings,
  ...shipping,
  ...shippingRates,
  ...shopifyImport,
  ...notifications,
  ...staff,
  ...staffInvites,
  ...states,
  ...storeData,
  ...storageWarning,
  ...table,
  ...themeImport,
  ...themes,
  ...umami,
]
