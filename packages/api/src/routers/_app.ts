import { protectedProcedure } from '../procedures'
import { productsRouter } from './products'
import { storeRouter } from './store'

export const appRouter = {
  me: protectedProcedure.handler(({ context }) => context.session),
  store: storeRouter,
  products: productsRouter,
}

export type AppRouter = typeof appRouter
