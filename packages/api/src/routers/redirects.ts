import {
  allRedirects,
  DuplicateRedirect,
  deleteRedirects,
  dismissBrokenLinks,
  importRedirectsCsv,
  listBrokenLinks,
  listRedirects,
  parseRedirectsCsv,
  permissions,
  RedirectLoop,
  RedirectWriteSchema,
  redirectCsvLoops,
  redirectsToCsv,
  saveRedirect,
} from '@commerce/core'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { can, heavy, PAGE_MAX, PAGE_SIZE_MAX, SEARCH_MAX } from '../procedures'

/** A redirects CSV is two short columns; 2 MB holds far more than the 5,000-row cap. */
const MAX_CSV_CHARS = 2_000_000

/** URL redirects: Content → Menus → URL redirects. Served by the storefront proxy. */
export const redirectsRouter = {
  list: can(permissions.ONLINE_STORE_READ)
    .input(
      z.object({
        page: z.number().int().min(1).max(PAGE_MAX).default(1),
        perPage: z.number().int().min(1).max(PAGE_SIZE_MAX).default(50),
        query: z.string().trim().max(SEARCH_MAX).optional(),
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
        if (err instanceof DuplicateRedirect || err instanceof RedirectLoop) {
          throw new ORPCError('CONFLICT', { message: err.message })
        }
        throw err
      }
    }),

  delete: can(permissions.ONLINE_STORE_WRITE)
    .input(z.object({ ids: z.array(z.uuid()).min(1).max(250) }))
    .handler(({ context, input }) => deleteRedirects(context.tx, input.ids)),

  /**
   * Broken links tab: storefront paths that answered 404, most hit first, each with the closest
   * product or collection as a suggested target. A redirect from the path takes it off the list.
   */
  brokenLinks: can(permissions.ONLINE_STORE_READ)
    .input(
      z.object({
        page: z.number().int().min(1).max(PAGE_MAX).default(1),
        perPage: z.number().int().min(1).max(PAGE_SIZE_MAX).default(50),
        query: z.string().trim().max(SEARCH_MAX).optional(),
      }),
    )
    .handler(({ context, input }) => listBrokenLinks(context.tx, input)),

  /** Hide broken paths; one hit again after this comes back. */
  dismissBrokenLinks: can(permissions.ONLINE_STORE_WRITE)
    .input(z.object({ ids: z.array(z.uuid()).min(1).max(250) }))
    .handler(({ context, input }) => dismissBrokenLinks(context.tx, input.ids)),

  /** Every redirect as Shopify's two-column CSV (`Redirect from`, `Redirect to`). */
  exportCsv: can(permissions.ONLINE_STORE_READ)
    .use(heavy('export'))
    .handler(async ({ context }) => {
      const csv = redirectsToCsv(await allRedirects(context.tx))
      // A byte order mark first, so Excel reads non-English paths as UTF-8.
      return new File([`﻿${csv}`], 'redirects.csv', { type: 'text/csv;charset=utf-8' })
    }),

  /**
   * Add or update redirects from a CSV. Bad rows are skipped and listed by line; with
   * `dryRun` nothing is written, so the admin can show what will happen first.
   */
  importCsv: can(permissions.ONLINE_STORE_WRITE)
    .use(heavy('import'))
    .input(z.object({ csv: z.string().max(MAX_CSV_CHARS), dryRun: z.boolean().default(false) }))
    .handler(async ({ context, input }) => {
      const parsed = parseRedirectsCsv(input.csv)
      // Rows that would loop are left out and named with the file's other problems.
      const loops = await redirectCsvLoops(context.tx, parsed.rows)
      const looped = new Set(loops.map((l) => l.line))
      const rows = parsed.rows.filter((r) => !looped.has(r.line))
      const problems = [
        ...parsed.problems,
        ...loops.map((l) => ({
          line: l.line,
          reason: `${l.target} leads back to ${l.path}, so shoppers would go round in a loop; row skipped`,
        })),
      ].sort((a, b) => a.line - b.line)
      if (input.dryRun) return { rows: rows.length, problems, created: 0, updated: 0, unchanged: 0 }
      const written = await importRedirectsCsv(context.tx, context.scope.storeId, rows)
      return { rows: rows.length, problems, ...written }
    }),
}
