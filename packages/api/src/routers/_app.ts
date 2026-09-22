import { protectedProcedure } from '../procedures'
import { analyticsRouter } from './analytics'
import { appsRouter } from './apps'
import { collectionsRouter } from './collections'
import { customersRouter } from './customers'
import { dashboardRouter } from './dashboard'
import { discountsRouter } from './discounts'
import { mediaRouter } from './media'
import { navigationRouter } from './navigation'
import { ordersRouter } from './orders'
import { pagesRouter } from './pages'
import { productsRouter } from './products'
import { staffRouter } from './staff'
import { storeRouter } from './store'

export const appRouter = {
  me: protectedProcedure.handler(({ context }) => context.session),
  store: storeRouter,
  products: productsRouter,
  collections: collectionsRouter,
  pages: pagesRouter,
  navigation: navigationRouter,
  orders: ordersRouter,
  customers: customersRouter,
  discounts: discountsRouter,
  apps: appsRouter,
  dashboard: dashboardRouter,
  analytics: analyticsRouter,
  media: mediaRouter,
  staff: staffRouter,
}

export type AppRouter = typeof appRouter
