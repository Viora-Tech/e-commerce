import { permissions } from '@commerce/core'
import { z } from 'zod'
import { can } from '../procedures'
import {
  createPage,
  deletePage,
  getPage,
  listPages,
  publishPage,
  saveDraft,
} from '../services/page.service'

const handle = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)

/** Puck's Data shape, validated loosely: content array plus root. Blocks validate their own props. */
const pageData = z.object({
  root: z.object({ props: z.record(z.string(), z.unknown()).optional() }).passthrough(),
  content: z.array(z.object({ type: z.string(), props: z.record(z.string(), z.unknown()) })),
  zones: z.record(z.string(), z.unknown()).optional(),
})

export const pagesRouter = {
  list: can(permissions.ONLINE_STORE_READ).handler(({ context }) => listPages(context.tx)),

  get: can(permissions.ONLINE_STORE_READ)
    .input(z.object({ id: z.uuid() }))
    .handler(({ context, input }) => getPage(context.tx, input.id)),

  create: can(permissions.ONLINE_STORE_WRITE)
    .input(z.object({ handle, title: z.string().trim().min(1).max(120), data: pageData }))
    .handler(({ context, input }) => createPage(context.tx, context.scope.storeId, input)),

  saveDraft: can(permissions.ONLINE_STORE_WRITE)
    .input(
      z.object({
        id: z.uuid(),
        title: z.string().trim().min(1).max(120).optional(),
        data: pageData,
      }),
    )
    .handler(({ context, input: { id, ...rest } }) => saveDraft(context.tx, id, rest)),

  publish: can(permissions.ONLINE_STORE_PUBLISH)
    .input(z.object({ id: z.uuid() }))
    .handler(({ context, input }) => publishPage(context.tx, input.id)),

  delete: can(permissions.ONLINE_STORE_WRITE)
    .input(z.object({ id: z.uuid() }))
    .handler(({ context, input }) => deletePage(context.tx, input.id)),
}
