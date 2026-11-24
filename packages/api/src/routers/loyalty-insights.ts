/**
 * Loyalty points v2, admin insights extras (`loyalty.insights.*`): member revenue by day with
 * the non-member total for the Analytics screen, and the dry run of a points import for the
 * Members screen. Both only read.
 */
import {
  loyaltyRevenueSeries,
  parsePointsCsv,
  permissions,
  previewPointImport,
} from '@commerce/core'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { can } from '../procedures'
import { ctxOf, requireInstalled } from './loyalty-common'

/** Same cap as `loyalty.members.import`. */
const IMPORT_ROWS_MAX = 20_000

export const loyaltyInsightsRouter = {
  /** Member revenue per store day, and what non-members spent, over `[from, to)`. */
  getRevenue: can(permissions.ANALYTICS_READ)
    .input(z.object({ from: z.coerce.date(), to: z.coerce.date() }))
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      if (input.to <= input.from) {
        throw new ORPCError('BAD_REQUEST', { message: 'The end must be after the start' })
      }
      return loyaltyRevenueSeries(ctxOf(context), input)
    }),
  /** Reads an import file and says what importing it would do; changes nothing. */
  previewImport: can(permissions.CUSTOMERS_READ)
    .input(z.object({ csv: z.string().max(2_000_000) }))
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      const parsed = parsePointsCsv(input.csv)
      if (parsed.rows.length > IMPORT_ROWS_MAX) {
        throw new ORPCError('BAD_REQUEST', { message: `At most ${IMPORT_ROWS_MAX} rows per file` })
      }
      const preview = await previewPointImport(ctxOf(context), parsed.rows)
      return {
        rows: parsed.rows.length,
        points: parsed.rows.reduce((s, r) => s + r.points, 0),
        errors: parsed.errors.slice(0, 100),
        errorCount: parsed.errors.length,
        ...preview,
      }
    }),
}
