/** SOURCE OF TRUTH: the Shipments workspace's printouts — WHAT: a batch's labels as one PDF and the pickup manifest the courier's executive signs / WHY: kept out of shipments.ts (500-line cap) and spread into `shipmentsRouter`, so the paths stay `shipments.labelSheet` and `shipments.manifestSheet`. */
import { settingsSecret } from '@commerce/config'
import {
  LABEL_SHEET_FORMATS,
  LABEL_SHEET_MAX,
  MANIFEST_SHEET_MAX,
  permissions,
} from '@commerce/core'
import { dayKey } from '@commerce/dates'
import { z } from 'zod'
import { can, heavy } from '../procedures'
import { storeRegistries } from '../services/apps.service'
import { printLabelSheet } from '../services/label-sheet.service'
import { printManifestSheet } from '../services/manifest-sheet.service'

export const printProcedures = {
  /**
   * A batch's labels as one PDF in the merchant's paper (Figma 909:9249, the bulk result's
   * Print card; also Shipments › Booked's selection): 4 × 6 in thermal one per page, A4 four
   * per sheet, or each courier's own pages. Ids outside the caller's store are skipped as not
   * found; labels the courier has not sent, or that could not be fetched, are skipped and named.
   * `file` is null when none could be printed.
   */
  labelSheet: can(permissions.ORDERS_READ)
    .use(heavy('export'))
    .input(
      z.object({
        ids: z.array(z.uuid()).min(1).max(LABEL_SHEET_MAX),
        format: z.enum(LABEL_SHEET_FORMATS),
      }),
    )
    .handler(async ({ context, input }) => {
      const { shipping } = await storeRegistries(context.tx, context.scope.storeId)
      const sheet = await printLabelSheet(
        context.tx,
        context.scope.storeId,
        shipping,
        settingsSecret(),
        input.ids,
        input.format,
      )
      const name = `labels-${dayKey(new Date())}.pdf`
      return {
        file: sheet.pdf
          ? new File([sheet.pdf as Uint8Array<ArrayBuffer>], name, { type: 'application/pdf' })
          : null,
        printed: sheet.printed,
        skipped: sheet.skipped,
      }
    }),

  /**
   * The pickup manifest as one A4 PDF (Shipments › To be picked up, "Print manifest"): one page
   * per courier pickup listing AWB, order, ship-to, city and PIN, weight and COD or Prepaid, with
   * the count and signature lines. The ticked shipments, or every parcel in To be picked up when
   * none are sent. A manifest on file for exactly those shipments is reused; otherwise one is
   * recorded. Our own record, never sent to the courier.
   */
  manifestSheet: can(permissions.ORDERS_FULFIL)
    .use(heavy('export'))
    .input(
      z.object({
        shipmentIds: z.array(z.uuid()).min(1).max(MANIFEST_SHEET_MAX).optional(),
        provider: z.string().trim().min(1).max(60).optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const { shipping } = await storeRegistries(context.tx, context.scope.storeId)
      const sheet = await printManifestSheet(context.tx, context.scope.storeId, shipping, input)
      const name = `manifest-${dayKey(new Date())}.pdf`
      return {
        file: new File([sheet.pdf as Uint8Array<ArrayBuffer>], name, { type: 'application/pdf' }),
        manifests: sheet.manifests,
        shipments: sheet.shipments,
        created: sheet.created,
      }
    }),
}
