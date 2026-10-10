import { protectedProcedure } from '../procedures'
import { aiRouter } from './ai'
import { analyticsRouter } from './analytics'
import { appearanceRouter } from './appearance'
import { appsRouter } from './apps'
import { backInStockRouter } from './back-in-stock'
import { blogRouter } from './blog'
import { bugReportsRouter } from './bug-reports'
import { businessGstRouter } from './business-gst'
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
import { gstInvoicesRouter } from './gst-invoices'
import { inventoryRouter, purchaseOrdersRouter, transfersRouter } from './inventory'
import { invitationsRouter } from './invitations'
import { marketingRouter } from './marketing'
import { mediaRouter } from './media'
import { metaobjectsRouter } from './metaobjects'
import { navigationRouter } from './navigation'
import { notificationsRouter } from './notifications'
import { onboardingRouter } from './onboarding'
import { ordersRouter } from './orders'
import { pagesRouter } from './pages'
import { paymentsRouter } from './payments'
import { policiesRouter } from './policies'
import { productsRouter } from './products'
import { profitCostsRouter } from './profit-costs'
import { purchaseDocumentsRouter } from './purchase-documents'
import { inboundShipmentsRouter, purchaseChargesRouter, suppliersRouter } from './purchasing'
import { redirectsRouter } from './redirects'
import { returnsRouter } from './returns'
import { reviewsRouter } from './reviews'
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
  me: protectedProcedure.handler(({ context }) => context.session),
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
  blog: blogRouter,
  metaobjects: metaobjectsRouter,
  navigation: navigationRouter,
  redirects: redirectsRouter,
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
  discounts: discountsRouter,
  marketing: marketingRouter,
  shortLinks: shortLinksRouter,
  giftCards: giftCardsRouter,
  apps: appsRouter,
  gstInvoices: gstInvoicesRouter,
  taxes: taxesRouter,
  businessGst: businessGstRouter,
  profitCosts: profitCostsRouter,
  shopifyImport: shopifyImportRouter,
  backInStock: backInStockRouter,
  emi: emiRouter,
  forms: formsRouter,
  reviews: reviewsRouter,
  umami: umamiRouter,
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
