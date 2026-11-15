/**
 * The GST invoices app's numbering series: what each prints next, and moving one series' next
 * number. Split out of `./gst-invoices.ts`, which mounts these as `gstInvoices.seriesNext` and
 * `gstInvoices.series.*`.
 */
import { permissions } from '@commerce/core'
import { SeriesSchema } from '@commerce/invoices'
import { loadSettings, setSeriesNextNumber } from '@commerce/plugin-gst-invoices/server'
import { z } from 'zod'
import { can } from '../procedures'
import { asOrpc, Gst, gstScope, nextNumbers, requireInstalled } from './gst-invoices-context'

/** The next number each series will print this financial year, for the settings preview. */
export const seriesNext = can(permissions.SETTINGS_READ)
  .input(z.object({ gstRegistrationId: Gst }).optional())
  .handler(async ({ context, input }) => {
    await requireInstalled(context)
    const settings = await loadSettings(context.tx, context.scope.storeId)
    return nextNumbers(context, settings, await gstScope(context, input?.gstRegistrationId))
  })

export const seriesProcedures = {
  /**
   * Set one series' next number for a GST number, never below a number already used. For export
   * invoices carrying on after the last number a previous billing system issued.
   */
  setNext: can(permissions.SETTINGS_MANAGE)
    .input(
      z.object({
        seriesId: SeriesSchema.shape.id,
        nextNumber: z.number().int().min(1),
        gstRegistrationId: Gst,
      }),
    )
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      const gst = await gstScope(context, input.gstRegistrationId)
      try {
        return await setSeriesNextNumber(
          context.tx,
          context.scope.storeId,
          gst,
          input.seriesId,
          input.nextNumber,
        )
      } catch (err) {
        asOrpc(err)
      }
    }),
}
