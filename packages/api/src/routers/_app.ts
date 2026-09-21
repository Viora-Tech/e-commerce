import { protectedProcedure } from '../procedures'
import { appsRouter } from './apps'
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
  apps: appsRouter,
}

export type AppRouter = typeof appRouter
