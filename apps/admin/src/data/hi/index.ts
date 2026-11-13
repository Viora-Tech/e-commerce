import type { TranslationPair } from '@/lib/i18n'
import abandonedDetail from './abandoned-detail'
import account from './account'
import activity from './activity'
import activityLog from './activity-log'
import affiliateCreatives from './affiliate-creatives'
import affiliateFilters from './affiliate-filters'
import affiliates from './affiliates'
import ai from './ai'
import analytics from './analytics'
import appInstall from './app-install'
import approvals from './approvals'
import apps from './apps'
import assistant from './assistant'
import automationRecords from './automation-records'
import automations from './automations'
import backInStock from './back-in-stock'
import backgroundWork from './background-work'
import billing from './billing'
import bluedart from './bluedart'
import bugReport from './bug-report'
import bulkActions from './bulk-actions'
import bulkEdit from './bulk-edit'
import bulkShip from './bulk-ship'
import businessGst from './business-gst'
import catalogs from './catalogs'
import chatwoot from './chatwoot'
import checkoutRules from './checkout-rules'
import checkoutSettings from './checkout-settings'
import codRto from './cod-rto'
import collections from './collections'
import commandPalette from './command-palette'
import common from './common'
import connectAside from './connect-aside'
import content from './content'
import contentBlog from './content-blog'
import contentFiles from './content-files'
import createShipment from './create-shipment'
import customData from './custom-data'
import customerAddresses from './customer-addresses'
import customerGiftCards from './customer-gift-cards'
import customerMerge from './customer-merge'
import customerStoreCredit from './customer-store-credit'
import customers from './customers'
import customersBulkEdit from './customers-bulk-edit'
import customizeAi from './customize-ai'
import customizeAppEmbeds from './customize-app-embeds'
import customizeInboxEmbed from './customize-inbox-embed'
import dateRange from './date-range'
import dates from './dates'
import deliveryOptions from './delivery-options'
import dhlExpress from './dhl-express'
import discounts from './discounts'
import documentTemplates from './document-templates'
import domains from './domains'
import draftStoreCredit from './draft-store-credit'
import drafts from './drafts'
import dtdc from './dtdc'
import dynamicSources from './dynamic-sources'
import ekart from './ekart'
import emailBuilder from './email-builder'
import emailSuppression from './email-suppression'
import fedex from './fedex'
import filterPanel from './filter-panel'
import gatewayKeys from './gateway-keys'
import giftCards from './gift-cards'
import growth from './growth'
import growthHome from './growth-home'
import growthReport from './growth-report'
import growthbook from './growthbook'
import gstInvoices from './gst-invoices'
import home from './home'
import honoProduct from './hono-product'
import imageEditor from './image-editor'
import inbox from './inbox'
import inboxConversations from './inbox-conversations'
import inboxKnowledge from './inbox-knowledge'
import indiaPost from './india-post'
import installedApps from './installed-apps'
import inventory from './inventory'
import layout from './layout'
import localDelivery from './local-delivery'
import login from './login'
import marketingAutomations from './marketing-automations'
import marketingCampaigns from './marketing-campaigns'
import markets from './markets'
import mcp from './mcp'
import meilisearch from './meilisearch'
import metaobjects from './metaobjects'
import monthlyExpenses from './monthly-expenses'
import navigation from './navigation'
import notifications from './notifications'
import onboarding from './onboarding'
import orderAppActions from './order-app-actions'
import orderCards from './order-cards'
import orderDetail from './order-detail'
import orderEdit from './order-edit'
import orderHold from './order-hold'
import orderListFilters from './order-list-filters'
import orders from './orders'
import ordersBulk from './orders-bulk'
import ordersBulkEdit from './orders-bulk-edit'
import paymentModes from './payment-modes'
import paymentProviders from './payment-providers'
import paymentRouting from './payment-routing'
import paymentRules from './payment-rules'
import payments from './payments'
import paymentsSetup from './payments-setup'
import pixels from './pixels'
import platform from './platform'
import preorders from './preorders'
import productBulkShipping from './product-bulk-shipping'
import productForm from './product-form'
import productPage from './product-page'
import productShipping from './product-shipping'
import products from './products'
import profitCosts from './profit-costs'
import profitReport from './profit-report'
import purchaseDocuments from './purchase-documents'
import purchasing from './purchasing'
import razorpayWebsites from './razorpay-websites'
import resourcePicker from './resource-picker'
import returns from './returns'
import reviewTools from './review-tools'
import reviews from './reviews'
import rollouts from './rollouts'
import searchApp from './search-app'
import searchConsole from './search-console'
import searchDiscovery from './search-discovery'
import searchFilters from './search-filters'
import selectProducts from './select-products'
import seoKeywords from './seo-keywords'
import seoReport from './seo-report'
import settings from './settings'
import settingsRows from './settings-rows'
import shadowfax from './shadowfax'
import shipglobal from './shipglobal'
import shipments from './shipments'
import shipping from './shipping'
import shippingRates from './shipping-rates'
import shopifyAppInstall from './shopify-app-install'
import shopifyImport from './shopify-import'
import shopifyImportFiles from './shopify-import-files'
import shopifyImportRun from './shopify-import-run'
import shopifyImportSettings from './shopify-import-settings'
import staff from './staff'
import staffInvites from './staff-invites'
import states from './states'
import stepUp from './step-up'
import storageWarning from './storage-warning'
import storeCreditExpiry from './store-credit-expiry'
import storeCreditGiftCards from './store-credit-gift-cards'
import storeData from './store-data'
import storeHealth from './store-health'
import table from './table'
import themeCode from './theme-code'
import themeImport from './theme-import'
import themes from './themes'
import umami from './umami'
import variantBox from './variant-box'
import variantPage from './variant-page'
import whatsappChat from './whatsapp-chat'
import whatsappSignup from './whatsapp-signup'
import xpressbees from './xpressbees'

/**
 * Every Hindi translation, as [English export, Hindi overlay] pairs. A `data/<feature>.ts`
 * with no entry here stays English. Add a feature: write `data/hi/<feature>.ts` (default
 * export: an array of `translation(...)` pairs) and spread it in below.
 */
export const hindiCopy: readonly TranslationPair[] = [
  ...activity,
  ...activityLog,
  ...account,
  ...affiliates,
  ...affiliateCreatives,
  ...affiliateFilters,
  ...appInstall,
  ...apps,
  ...abandonedDetail,
  ...customerGiftCards,
  ...customerMerge,
  ...customerStoreCredit,
  ...storeCreditGiftCards,
  ...storeCreditExpiry,
  ...ai,
  ...assistant,
  ...automationRecords,
  ...automations,
  ...backInStock,
  ...backgroundWork,
  ...billing,
  ...bluedart,
  ...mcp,
  ...approvals,
  ...bugReport,
  ...bulkActions,
  ...bulkEdit,
  ...bulkShip,
  ...businessGst,
  ...checkoutRules,
  ...checkoutSettings,
  ...codRto,
  ...deliveryOptions,
  ...common,
  ...resourcePicker,
  ...connectAside,
  ...content,
  ...contentBlog,
  ...contentFiles,
  ...createShipment,
  ...customData,
  ...customerAddresses,
  ...customers,
  ...customersBulkEdit,
  ...customizeAi,
  ...customizeAppEmbeds,
  ...customizeInboxEmbed,
  ...dates,
  ...dhlExpress,
  ...fedex,
  ...shipglobal,
  ...gatewayKeys,
  ...giftCards,
  ...drafts,
  ...draftStoreCredit,
  ...domains,
  ...emailBuilder,
  ...dtdc,
  ...analytics,
  ...discounts,
  ...dynamicSources,
  ...dateRange,
  ...filterPanel,
  ...growth,
  ...growthHome,
  ...growthReport,
  ...gstInvoices,
  ...home,
  ...honoProduct,
  ...imageEditor,
  ...indiaPost,
  ...installedApps,
  ...layout,
  ...marketingAutomations,
  ...marketingCampaigns,
  ...markets,
  ...catalogs,
  ...rollouts,
  ...login,
  ...metaobjects,
  ...navigation,
  ...onboarding,
  ...orderAppActions,
  ...orderCards,
  ...orderDetail,
  ...orderEdit,
  ...orderHold,
  ...orderListFilters,
  ...shopifyImportFiles,
  ...shopifyImportRun,
  ...shopifyImportSettings,
  ...orders,
  ...ordersBulk,
  ...ordersBulkEdit,
  ...payments,
  ...paymentModes,
  ...paymentProviders,
  ...paymentRouting,
  ...paymentRules,
  ...paymentsSetup,
  ...pixels,
  ...platform,
  ...razorpayWebsites,
  ...collections,
  ...commandPalette,
  ...inventory,
  ...productForm,
  ...productBulkShipping,
  ...productShipping,
  ...variantBox,
  ...variantPage,
  ...preorders,
  ...productPage,
  ...products,
  ...purchaseDocuments,
  ...profitCosts,
  ...profitReport,
  ...inbox,
  ...inboxConversations,
  ...inboxKnowledge,
  ...monthlyExpenses,
  ...purchasing,
  ...selectProducts,
  ...returns,
  ...reviewTools,
  ...reviews,
  ...settings,
  ...settingsRows,
  ...shipments,
  ...shipping,
  ...shippingRates,
  ...localDelivery,
  ...documentTemplates,
  ...shopifyImport,
  ...shopifyAppInstall,
  ...notifications,
  ...staff,
  ...staffInvites,
  ...states,
  ...stepUp,
  ...storeData,
  ...storeHealth,
  ...storageWarning,
  ...table,
  ...themeCode,
  ...themeImport,
  ...themes,
  ...searchApp,
  ...searchDiscovery,
  ...searchFilters,
  ...searchConsole,
  ...seoReport,
  ...seoKeywords,
  ...umami,
  ...meilisearch,
  ...chatwoot,
  ...xpressbees,
  ...ekart,
  ...emailSuppression,
  ...shadowfax,
  ...growthbook,
  ...whatsappSignup,
  ...whatsappChat,
]
