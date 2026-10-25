import { permissions } from '@commerce/core'
import { z } from 'zod'
import { can } from '../procedures'
import { createPage, deletePage, getPage, listPages, updatePage } from '../services/page.service'

const handle = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)

const templateSuffix = z
  .string()
  .regex(/^[a-z0-9-]{0,40}$/)
  .nullable()

/** Lexical JSON, validated loosely; the rich-text package parses it on render. */
const body = z.record(z.string(), z.unknown()).nullable()

export const pagesRouter = {
  list: can(permissions.ONLINE_STORE_READ).handler(({ context }) => listPages(context.tx)),

  get: can(permissions.ONLINE_STORE_READ)
    .input(z.object({ id: z.uuid() }))
    .handler(({ context, input }) => getPage(context.tx, input.id)),

  create: can(permissions.ONLINE_STORE_WRITE)
    .input(
      z.object({
        handle,
        title: z.string().trim().min(1).max(120),
        templateSuffix: templateSuffix.optional(),
      }),
    )
    .handler(({ context, input }) => createPage(context.tx, context.scope.storeId, input)),

  update: can(permissions.ONLINE_STORE_WRITE)
    .input(
      z.object({
        id: z.uuid(),
        title: z.string().trim().min(1).max(120).optional(),
        handle: handle.optional(),
        body: body.optional(),
        seoTitle: z.string().trim().max(70).nullable().optional(),
        seoDescription: z.string().trim().max(320).nullable().optional(),
        templateSuffix: templateSuffix.optional(),
        visible: z.boolean().optional(),
      }),
    )
    .handler(({ context, input: { id, ...rest } }) =>
      updatePage(context.tx, context.scope.storeId, id, rest),
    ),

  delete: can(permissions.ONLINE_STORE_WRITE)
    .input(z.object({ id: z.uuid() }))
    .handler(({ context, input }) => deletePage(context.tx, input.id)),
}
