import { z } from 'zod'
import { storeProcedure } from '../procedures'
import { getProduct, listProducts, updateProduct, updateVariant } from '../services/product.service'

const status = z.enum(['draft', 'active', 'archived'])
const handle = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)

export const productsRouter = {
  list: storeProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        perPage: z.number().int().min(1).max(100).default(25),
        search: z.string().trim().max(200).optional(),
        status: status.optional(),
      }),
    )
    .handler(({ context, input }) => listProducts(context.tx, input)),

  get: storeProcedure
    .input(z.object({ id: z.uuid() }))
    .handler(({ context, input }) => getProduct(context.tx, input.id)),

  update: storeProcedure
    .input(
      z.object({
        id: z.uuid(),
        title: z.string().trim().min(1).max(200).optional(),
        handle: handle.optional(),
        description: z.string().max(20000).nullable().optional(),
        vendor: z.string().max(100).nullable().optional(),
        productType: z.string().max(100).nullable().optional(),
        status: status.optional(),
      }),
    )
    .handler(({ context, input: { id, ...patch } }) => updateProduct(context.tx, id, patch)),

  updateVariant: storeProcedure
    .input(
      z.object({
        id: z.uuid(),
        pricePaise: z.number().int().min(0).optional(),
        mrpPaise: z.number().int().min(0).nullable().optional(),
        sku: z.string().max(100).nullable().optional(),
        onHand: z.number().int().min(0).optional(),
      }),
    )
    .handler(({ context, input: { id, ...patch } }) => updateVariant(context.tx, id, patch)),
}
