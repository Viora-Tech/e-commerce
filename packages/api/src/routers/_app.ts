import { protectedProcedure } from '../procedures'
import { analyticsRouter } from './analytics'
import { appsRouter } from './apps'
import { customersRouter } from './customers'
import { dashboardRouter } from './dashboard'
import { discountsRouter } from './discounts'
import { mediaRouter } from './media'
import { ordersRouter } from './orders'
import { pagesRouter } from './pages'
import { productsRouter } from './products'
import { storeRouter } from './store'

export const appRouter = {
  me: protectedProcedure.handler(({ context }) => context.session),
  store: storeRouter,
  products: productsRouter,
  pages: pagesRouter,
  orders: ordersRouter,
  customers: customersRouter,
  discounts: discountsRouter,
  apps: appsRouter,
  dashboard: dashboardRouter,
  analytics: analyticsRouter,
  media: mediaRouter,
}

export type AppRouter = typeof appRouter
