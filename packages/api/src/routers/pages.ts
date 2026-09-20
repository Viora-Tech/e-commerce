import { z } from 'zod'
import { storeProcedure } from '../procedures'
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
  list: storeProcedure.handler(({ context }) => listPages(context.tx)),

  get: storeProcedure
    .input(z.object({ id: z.uuid() }))
    .handler(({ context, input }) => getPage(context.tx, input.id)),

  create: storeProcedure
    .input(z.object({ handle, title: z.string().trim().min(1).max(120), data: pageData }))
    .handler(({ context, input }) => createPage(context.tx, context.scope.storeId, input)),

  saveDraft: storeProcedure
    .input(
      z.object({
        id: z.uuid(),
        title: z.string().trim().min(1).max(120).optional(),
        data: pageData,
      }),
    )
    .handler(({ context, input: { id, ...rest } }) => saveDraft(context.tx, id, rest)),

  publish: storeProcedure
    .input(z.object({ id: z.uuid() }))
    .handler(({ context, input }) => publishPage(context.tx, input.id)),

  delete: storeProcedure
    .input(z.object({ id: z.uuid() }))
    .handler(({ context, input }) => deletePage(context.tx, input.id)),
}
