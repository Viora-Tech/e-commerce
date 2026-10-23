import type { TranslationPair } from '@/lib/i18n'
import abandonedDetail from './abandoned-detail'
import account from './account'
import activity from './activity'
import ai from './ai'
import analytics from './analytics'
import appInstall from './app-install'
import apps from './apps'
import assistant from './assistant'
import automations from './automations'
import backgroundWork from './background-work'
import billing from './billing'
import bluedart from './bluedart'
import bugReport from './bug-report'
import bulkActions from './bulk-actions'
import bulkEdit from './bulk-edit'
import businessGst from './business-gst'
import chatwoot from './chatwoot'
import checkoutSettings from './checkout-settings'
import collections from './collections'
import commandPalette from './command-palette'
import common from './common'
import connectAside from './connect-aside'
import content from './content'
import contentBlog from './content-blog'
import contentFiles from './content-files'
import createShipment from './create-shipment'
import customers from './customers'
import customersBulkEdit from './customers-bulk-edit'
import customizeAi from './customize-ai'
import customizeMedia from './customize-media'
import dateRange from './date-range'
import dates from './dates'
import dhlExpress from './dhl-express'
import discounts from './discounts'
import domains from './domains'
import drafts from './drafts'
import dtdc from './dtdc'
import ekart from './ekart'
import emailBuilder from './email-builder'
import fedex from './fedex'
import filterPanel from './filter-panel'
import giftCards from './gift-cards'
import growth from './growth'
import growthbook from './growthbook'
import gstInvoices from './gst-invoices'
import home from './home'
import imageEditor from './image-editor'
import indiaPost from './india-post'
import installedApps from './installed-apps'
import inventory from './inventory'
import layout from './layout'
import login from './login'
import marketingAutomations from './marketing-automations'
import marketingCampaigns from './marketing-campaigns'
import mcp from './mcp'
import meilisearch from './meilisearch'
import metaobjects from './metaobjects'
import navigation from './navigation'
import notifications from './notifications'
import onboarding from './onboarding'
import orderAppActions from './order-app-actions'
import orderCards from './order-cards'
import orders from './orders'
import ordersBulk from './orders-bulk'
import ordersBulkEdit from './orders-bulk-edit'
import paymentModes from './payment-modes'
import payments from './payments'
import paymentsSetup from './payments-setup'
import productPage from './product-page'
import products from './products'
import profitCosts from './profit-costs'
import purchaseDocuments from './purchase-documents'
import purchasing from './purchasing'
import razorpayWebsites from './razorpay-websites'
import returns from './returns'
import reviews from './reviews'
import searchApp from './search-app'
import searchConsole from './search-console'
import selectProducts from './select-products'
import seoKeywords from './seo-keywords'
import seoReport from './seo-report'
import settings from './settings'
import shadowfax from './shadowfax'
import shipments from './shipments'
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
import themeCode from './theme-code'
import themeImport from './theme-import'
import themes from './themes'
import umami from './umami'
import xpressbees from './xpressbees'

/**
 * Every Hindi translation, as [English export, Hindi overlay] pairs. A `data/<feature>.ts`
 * with no entry here stays English. Add a feature: write `data/hi/<feature>.ts` (default
 * export: an array of `translation(...)` pairs) and spread it in below.
 */
export const hindiCopy: readonly TranslationPair[] = [
  ...activity,
  ...account,
  ...appInstall,
  ...apps,
  ...abandonedDetail,
  ...ai,
  ...assistant,
  ...automations,
  ...backgroundWork,
  ...billing,
  ...bluedart,
  ...mcp,
  ...bugReport,
  ...bulkActions,
  ...bulkEdit,
  ...businessGst,
  ...checkoutSettings,
  ...common,
  ...connectAside,
  ...content,
  ...contentBlog,
  ...contentFiles,
  ...createShipment,
  ...customers,
  ...customersBulkEdit,
  ...customizeAi,
  ...customizeMedia,
  ...dates,
  ...dhlExpress,
  ...fedex,
  ...giftCards,
  ...drafts,
  ...domains,
  ...emailBuilder,
  ...dtdc,
  ...analytics,
  ...discounts,
  ...dateRange,
  ...filterPanel,
  ...growth,
  ...gstInvoices,
  ...home,
  ...imageEditor,
  ...indiaPost,
  ...installedApps,
  ...layout,
  ...marketingAutomations,
  ...marketingCampaigns,
  ...login,
  ...metaobjects,
  ...navigation,
  ...onboarding,
  ...orderAppActions,
  ...orderCards,
  ...shopifyImportFiles,
  ...shopifyImportRun,
  ...shopifyImportSettings,
  ...orders,
  ...ordersBulk,
  ...ordersBulkEdit,
  ...payments,
  ...paymentModes,
  ...paymentsSetup,
  ...razorpayWebsites,
  ...collections,
  ...commandPalette,
  ...inventory,
  ...productPage,
  ...products,
  ...purchaseDocuments,
  ...profitCosts,
  ...purchasing,
  ...selectProducts,
  ...returns,
  ...reviews,
  ...settings,
  ...shipments,
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
  ...themeCode,
  ...themeImport,
  ...themes,
  ...searchApp,
  ...searchConsole,
  ...seoReport,
  ...seoKeywords,
  ...umami,
  ...meilisearch,
  ...chatwoot,
  ...xpressbees,
  ...ekart,
  ...shadowfax,
  ...growthbook,
]
