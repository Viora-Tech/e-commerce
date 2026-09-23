import {
  DuplicateRedirect,
  deleteRedirects,
  listRedirects,
  permissions,
  RedirectWriteSchema,
  saveRedirect,
} from '@commerce/core'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { can } from '../procedures'

/** URL redirects: Content → Menus → URL redirects. Served by the storefront proxy. */
export const redirectsRouter = {
  list: can(permissions.ONLINE_STORE_READ)
    .input(
      z.object({
        page: z.number().int().min(1).max(10_000).default(1),
        perPage: z.number().int().min(1).max(100).default(50),
        query: z.string().trim().max(200).optional(),
        sort: z.enum(['path', 'newest']).default('newest'),
      }),
    )
    .handler(({ context, input }) => listRedirects(context.tx, input)),

  save: can(permissions.ONLINE_STORE_WRITE)
    .input(z.object({ id: z.uuid().optional(), path: z.string(), target: z.string() }))
    .handler(async ({ context, input }) => {
      const parsed = RedirectWriteSchema.safeParse(input)
      if (!parsed.success) {
        throw new ORPCError('BAD_REQUEST', {
          message: parsed.error.issues.map((i) => i.message).join('. '),
        })
      }
      try {
        return await saveRedirect(context.tx, context.scope.storeId, {
          ...parsed.data,
          id: input.id,
        })
      } catch (err) {
        if (err instanceof DuplicateRedirect) {
          throw new ORPCError('CONFLICT', { message: err.message })
        }
        throw err
      }
    }),

  delete: can(permissions.ONLINE_STORE_WRITE)
    .input(z.object({ ids: z.array(z.uuid()).min(1).max(250) }))
    .handler(({ context, input }) => deleteRedirects(context.tx, input.ids)),
}
