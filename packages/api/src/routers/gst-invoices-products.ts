/**
 * The GST invoices app's Products tab: every product's Charge GST switch, GST rate and HSN
 * code, set one at a time or many at once. Written straight onto the products, so checkout and
 * invoices use them from the next order.
 */
import { permissions } from '@commerce/core'
import { z } from 'zod'
import { BULK_MAX, can, PAGE_MAX, PAGE_SIZE_MAX, SEARCH_MAX } from '../procedures'
import {
  GST_RATES,
  listProductTax,
  PRODUCT_TAX_FILTERS,
  updateProductTax,
} from '../services/gst-product-tax.service'
import { requireInstalled } from './gst-invoices-context'

const Match = z.object({
  filter: z.enum(PRODUCT_TAX_FILTERS).default('all'),
  search: z.string().max(SEARCH_MAX).optional(),
})

const Hsn = z
  .string()
  .trim()
  .regex(/^\d{4,8}$/, 'An HSN code is 4 to 8 digits')
  .nullable()

const Rate = z
  .number()
  .int()
  .refine((n) => (GST_RATES as readonly number[]).includes(n), 'Pick a GST rate from the list')
  .nullable()

export const gstInvoicesProductsRouter = {
  list: can(permissions.PRODUCTS_READ)
    .input(
      Match.extend({
        page: z.number().int().min(1).max(PAGE_MAX).default(1),
        perPage: z.number().int().min(1).max(PAGE_SIZE_MAX).default(50),
      }),
    )
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      return listProductTax(context.tx, input)
    }),

  /** One product, the selected ones, or every product the filter matches. */
  update: can(permissions.PRODUCTS_WRITE)
    .input(
      z.object({
        target: z.union([
          z.object({ ids: z.array(z.uuid()).min(1).max(BULK_MAX) }),
          z.object({ match: Match }),
        ]),
        change: z
          .object({
            hsCode: Hsn.optional(),
            gstRatePercent: Rate.optional(),
            taxable: z.boolean().optional(),
          })
          .refine((c) => Object.values(c).some((v) => v !== undefined), 'Nothing to change'),
      }),
    )
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      return updateProductTax(context.tx, input.target, input.change)
    }),
}
