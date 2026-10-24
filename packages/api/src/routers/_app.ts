import { protectedProcedure } from '../procedures'
import { accountRouter } from './account'
import { activityRouter } from './activity'
import { affiliatesRouter } from './affiliates'
import { aiRouter } from './ai'
import { analyticsRouter } from './analytics'
import { apiAccessRouter } from './api-access'
import { appearanceRouter } from './appearance'
import { appsRouter } from './apps'
import { automationsRouter } from './automations'
import { backInStockRouter } from './back-in-stock'
import { billingRouter } from './billing'
import { blogRouter } from './blog'
import { bugReportsRouter } from './bug-reports'
import { businessGstRouter } from './business-gst'
import { chatwootRouter } from './chatwoot'
import { checkoutSettingsRouter } from './checkout-settings'
import { collectionsRouter } from './collections'
import { customerAccountsRouter } from './customer-accounts'
import { customerPrivacyRouter } from './customer-privacy'
import { customersRouter } from './customers'
import { dashboardRouter } from './dashboard'
import { discountsRouter } from './discounts'
import { domainsRouter } from './domains'
import { emiRouter } from './emi'
import { formsRouter } from './forms'
import { giftCardsRouter } from './gift-cards'
import { growthbookRouter } from './growthbook'
import { gstInvoicesRouter } from './gst-invoices'
import { inboxRouter } from './inbox'
import { inventoryRouter, purchaseOrdersRouter, transfersRouter } from './inventory'
import { invitationsRouter } from './invitations'
import { marketingRouter } from './marketing'
import { mediaRouter } from './media'
import { meilisearchRouter } from './meilisearch'
import { metaobjectsRouter } from './metaobjects'
import { monthlyExpensesRouter } from './monthly-expenses'
import { navigationRouter } from './navigation'
import { notificationsRouter } from './notifications'
import { onboardingRouter } from './onboarding'
import { ordersRouter } from './orders'
import { pagesRouter } from './pages'
import { paymentsRouter } from './payments'
import { pixelsRouter } from './pixels'
import { platformAppsRouter } from './platform-apps'
import { policiesRouter } from './policies'
import { productsRouter } from './products'
import { profitCostsRouter } from './profit-costs'
import { purchaseDocumentsRouter } from './purchase-documents'
import { inboundShipmentsRouter, purchaseChargesRouter, suppliersRouter } from './purchasing'
import { redirectsRouter } from './redirects'
import { returnsRouter } from './returns'
import { reviewsRouter } from './reviews'
import { salesChannelsRouter } from './sales-channels'
import { searchRouter } from './search'
import { searchConsoleRouter } from './search-console'
import { seoRouter } from './seo'
import { shipmentsRouter } from './shipments'
import { shippingRouter } from './shipping'
import { shopifyImportRouter } from './shopify-import'
import { shortLinksRouter } from './short-links'
import { staffRouter } from './staff'
import { storeRouter } from './store'
import { storeDataRouter } from './store-data'
import { taxesRouter } from './taxes'
import { themesRouter } from './themes'
import { umamiRouter } from './umami'

export const appRouter = {
  activity: activityRouter,
  me: protectedProcedure.handler(({ context }) => context.session),
  account: accountRouter,
  store: storeRouter,
  storeData: storeDataRouter,
  appearance: appearanceRouter,
  themes: themesRouter,
  products: productsRouter,
  collections: collectionsRouter,
  inventory: inventoryRouter,
  purchaseOrders: purchaseOrdersRouter,
  transfers: transfersRouter,
  suppliers: suppliersRouter,
  inboundShipments: inboundShipmentsRouter,
  purchaseCharges: purchaseChargesRouter,
  purchaseDocuments: purchaseDocumentsRouter,
  pages: pagesRouter,
  apiAccess: apiAccessRouter,
  billing: billingRouter,
  blog: blogRouter,
  metaobjects: metaobjectsRouter,
  navigation: navigationRouter,
  redirects: redirectsRouter,
  salesChannels: salesChannelsRouter,
  seo: seoRouter,
  orders: ordersRouter,
  returns: returnsRouter,
  shipments: shipmentsRouter,
  shipping: shippingRouter,
  payments: paymentsRouter,
  checkoutSettings: checkoutSettingsRouter,
  policies: policiesRouter,
  customerPrivacy: customerPrivacyRouter,
  customerAccounts: customerAccountsRouter,
  notifications: notificationsRouter,
  customers: customersRouter,
  inbox: inboxRouter,
  discounts: discountsRouter,
  marketing: marketingRouter,
  automations: automationsRouter,
  shortLinks: shortLinksRouter,
  giftCards: giftCardsRouter,
  apps: appsRouter,
  gstInvoices: gstInvoicesRouter,
  taxes: taxesRouter,
  businessGst: businessGstRouter,
  profitCosts: profitCostsRouter,
  monthlyExpenses: monthlyExpensesRouter,
  shopifyImport: shopifyImportRouter,
  affiliates: affiliatesRouter,
  pixels: pixelsRouter,
  platformApps: platformAppsRouter,
  backInStock: backInStockRouter,
  emi: emiRouter,
  forms: formsRouter,
  reviews: reviewsRouter,
  umami: umamiRouter,
  chatwoot: chatwootRouter,
  growthbook: growthbookRouter,
  search: searchRouter,
  searchConsole: searchConsoleRouter,
  meilisearch: meilisearchRouter,
  dashboard: dashboardRouter,
  analytics: analyticsRouter,
  ai: aiRouter,
  media: mediaRouter,
  staff: staffRouter,
  domains: domainsRouter,
  invitations: invitationsRouter,
  onboarding: onboardingRouter,
  bugReports: bugReportsRouter,
}

export type AppRouter = typeof appRouter
