/**
 * The GST invoices Returns tab: one GSTIN's month as the GSTR-1 JSON the portal uploads, its
 * totals as a CSV, and the GSTR-3B outward tables as a page, CSV or PDF. Split out of
 * `./gst-invoices.ts`, which mounts these as `gstInvoices.returns.*`. Nothing here files
 * anything: the merchant uploads the JSON and types 3B in on the portal.
 */
import { permissions } from '@commerce/core'
import { gstStateName } from '@commerce/core/gstin'
import { formatInZone } from '@commerce/dates'
import { gstr1SummaryCsv, gstr3bCsv } from '@commerce/invoices'
import { renderGstr3bToBuffer } from '@commerce/invoices/render'
import { GstReturnError, gstReturn, periodRange } from '@commerce/plugin-gst-invoices/server'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { can } from '../procedures'
import { asOrpc, type Ctx, Gst, gstScope, Period, requireInstalled } from './gst-invoices-context'

const Input = z.object({ period: Period, gstRegistrationId: Gst })

async function load(context: Ctx, input: z.infer<typeof Input>) {
  await requireInstalled(context)
  const gst = await gstScope(context, input.gstRegistrationId)
  try {
    return await gstReturn(context.tx, context.scope.storeId, input.period, gst)
  } catch (err) {
    if (err instanceof GstReturnError) {
      throw new ORPCError('PRECONDITION_FAILED', { message: err.message })
    }
    asOrpc(err)
  }
}

const file = (body: Uint8Array | string, name: string, type: string) =>
  new File([typeof body === 'string' ? body : (body as Uint8Array<ArrayBuffer>)], name, { type })

/** `GSTR1_27AAAAA0000A1Z5_092026`: the GSTIN and the portal's MMYYYY period. */
const fileBase = (kind: string, gstin: string, period: string) =>
  `${kind}_${gstin}_${period.slice(5, 7)}${period.slice(0, 4)}`

const stateLabel = (pos: string) => (pos === '96' ? 'Other Country' : gstStateName(pos))

export const returnsProcedures = {
  /** Totals, warnings and the GSTR-3B figures for the Returns tab. */
  summary: can(permissions.ORDERS_READ)
    .input(Input)
    .handler(async ({ context, input }) => {
      const r = await load(context, input)
      return {
        gstin: r.gstin,
        legalName: r.legalName,
        period: r.period,
        filedAt: r.filedAt,
        totals: r.totals,
        documents: r.gstr1.doc_issue.doc_det,
        gstr3b: {
          ...r.gstr3b,
          unregisteredInterState: r.gstr3b.unregisteredInterState.map((p) => ({
            ...p,
            name: stateLabel(p.pos),
          })),
        },
        warnings: r.warnings,
      }
    }),

  /** The GSTR-1 JSON for the portal's "Prepare offline → Upload". */
  gstr1Json: can(permissions.ORDERS_READ)
    .input(Input)
    .handler(async ({ context, input }) => {
      const r = await load(context, input)
      return file(
        JSON.stringify(r.gstr1),
        `${fileBase('GSTR1', r.gstin, r.period)}.json`,
        'application/json',
      )
    }),

  /** The GSTR-1 totals per table, as a CSV for Excel. */
  gstr1Csv: can(permissions.ORDERS_READ)
    .input(Input)
    .handler(async ({ context, input }) => {
      const r = await load(context, input)
      return file(
        gstr1SummaryCsv(r.gstr1),
        `${fileBase('GSTR1_summary', r.gstin, r.period)}.csv`,
        'text/csv',
      )
    }),

  /** GSTR-3B 3.1 and 3.2 as a CSV or a one-page PDF. */
  gstr3b: can(permissions.ORDERS_READ)
    .input(Input.extend({ format: z.enum(['csv', 'pdf']) }))
    .handler(async ({ context, input }) => {
      const r = await load(context, input)
      const base = fileBase('GSTR3B', r.gstin, r.period)
      if (input.format === 'csv') {
        return file(gstr3bCsv(r.gstr3b, stateLabel), `${base}.csv`, 'text/csv')
      }
      const { from } = periodRange(r.period)
      const bytes = await renderGstr3bToBuffer({
        report: r.gstr3b,
        legalName: r.legalName,
        periodLabel: formatInZone(from.getTime() + 86_400_000, { month: 'long', year: 'numeric' }),
        stateName: stateLabel,
      })
      return file(bytes, `${base}.pdf`, 'application/pdf')
    }),
}
