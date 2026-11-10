/**
 * Which documents a bulk action on the Invoices list works on: the ticked rows, or everything
 * matching the list's filter (capped). Shared by the bulk download/print/email procedures in
 * `./gst-invoices.ts` and the bulk "Recalculate GST" in `./gst-invoices-order-actions.ts`.
 */
import { DOCUMENT_KINDS } from '@commerce/invoices'
import { documentIds } from '@commerce/plugin-gst-invoices/server'
import { z } from 'zod'
import { BULK_MAX } from '../procedures'
import { type Ctx, Gst } from './gst-invoices-context'

export const Filter = z.object({
  q: z.string().max(100).optional(),
  kind: z.union([z.enum(DOCUMENT_KINDS), z.array(z.enum(DOCUMENT_KINDS)).max(6)]).optional(),
  status: z.enum(['issued', 'cancelled']).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  /** One GST number's documents; omitted lists every GST number's. */
  gstRegistrationId: Gst,
})

/** Rows or "everything matching the filter", capped so one click cannot render the year. */
export const Selection = z.union([
  z.object({ ids: z.array(z.uuid()).min(1).max(BULK_MAX) }),
  z.object({ filter: Filter }),
])

export const selectedIds = async (context: Ctx, input: z.infer<typeof Selection>) =>
  'ids' in input ? input.ids : documentIds(context.tx, input.filter, 200)
