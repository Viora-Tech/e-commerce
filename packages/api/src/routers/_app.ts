import { protectedProcedure } from '../procedures'
import { analyticsRouter } from './analytics'
import { appsRouter } from './apps'
import { blogRouter } from './blog'
import { collectionsRouter } from './collections'
import { customersRouter } from './customers'
import { dashboardRouter } from './dashboard'
import { discountsRouter } from './discounts'
import { domainsRouter } from './domains'
import { giftCardsRouter } from './gift-cards'
import { gstInvoicesRouter } from './gst-invoices'
import { inventoryRouter, purchaseOrdersRouter, transfersRouter } from './inventory'
import { invitationsRouter } from './invitations'
import { mediaRouter } from './media'
import { metaobjectsRouter } from './metaobjects'
import { navigationRouter } from './navigation'
import { ordersRouter } from './orders'
import { pagesRouter } from './pages'
import { productsRouter } from './products'
import { redirectsRouter } from './redirects'
import { staffRouter } from './staff'
import { storeRouter } from './store'
import { themesRouter } from './themes'

export const appRouter = {
  me: protectedProcedure.handler(({ context }) => context.session),
  store: storeRouter,
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
  customers: customersRouter,
  discounts: discountsRouter,
  giftCards: giftCardsRouter,
  apps: appsRouter,
  gstInvoices: gstInvoicesRouter,
  dashboard: dashboardRouter,
  analytics: analyticsRouter,
  media: mediaRouter,
  staff: staffRouter,
  domains: domainsRouter,
  invitations: invitationsRouter,
}

export type AppRouter = typeof appRouter
