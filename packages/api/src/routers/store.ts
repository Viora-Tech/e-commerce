import { parseTheme, ThemeSchema } from '@commerce/core'
import { storeProcedure } from '../procedures'
import { getStore, updateStoreTheme } from '../services/store.service'

export const storeRouter = {
  current: storeProcedure.handler(async ({ context }) => {
    const s = await getStore(context.tx, context.scope.storeId)
    return s ? { ...s, theme: parseTheme(s.theme), role: context.scope.role } : null
  }),

  updateTheme: storeProcedure
    .input(ThemeSchema)
    .handler(({ context, input }) => updateStoreTheme(context.tx, context.scope.storeId, input)),
}
