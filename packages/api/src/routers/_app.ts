import { protectedProcedure } from '../procedures'
import { analyticsRouter } from './analytics'
import { appearanceRouter } from './appearance'
import { appsRouter } from './apps'
import { backInStockRouter } from './back-in-stock'
import { blogRouter } from './blog'
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
import { redirectsRouter } from './redirects'
import { returnsRouter } from './returns'
import { shipmentsRouter } from './shipments'
import { shippingRouter } from './shipping'
import { shopifyImportRouter } from './shopify-import'
import { staffRouter } from './staff'
import { storeRouter } from './store'
import { storeDataRouter } from './store-data'
import { taxesRouter } from './taxes'
import { themesRouter } from './themes'

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
  giftCards: giftCardsRouter,
  apps: appsRouter,
  gstInvoices: gstInvoicesRouter,
  taxes: taxesRouter,
  businessGst: businessGstRouter,
  shopifyImport: shopifyImportRouter,
  backInStock: backInStockRouter,
  emi: emiRouter,
  dashboard: dashboardRouter,
  analytics: analyticsRouter,
  media: mediaRouter,
  staff: staffRouter,
  domains: domainsRouter,
  invitations: invitationsRouter,
  onboarding: onboardingRouter,
}

export type AppRouter = typeof appRouter
