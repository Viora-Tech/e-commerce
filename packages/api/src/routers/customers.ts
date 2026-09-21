import { z } from 'zod'
import { storeProcedure } from '../procedures'
import {
  customerStats,
  getCustomer,
  listCustomers,
  updateCustomer,
} from '../services/customer.service'

export const customersRouter = {
  list: storeProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        perPage: z.number().int().min(1).max(100).default(25),
        search: z.string().trim().max(200).optional(),
        segment: z.enum(['new', 'returning']).optional(),
        sort: z.enum(['recent', 'name', 'orders', 'spent']).optional(),
      }),
    )
    .handler(({ context, input }) => listCustomers(context.tx, input)),

  stats: storeProcedure.handler(({ context }) => customerStats(context.tx)),

  get: storeProcedure
    .input(z.object({ id: z.uuid() }))
    .handler(({ context, input }) => getCustomer(context.tx, input.id)),

  update: storeProcedure
    .input(
      z.object({
        id: z.uuid(),
        name: z.string().trim().max(200).nullable().optional(),
        phone: z.string().trim().max(30).nullable().optional(),
        tags: z.array(z.string().trim().min(1).max(40)).max(50).optional(),
        note: z.string().trim().max(2000).nullable().optional(),
        acceptsMarketing: z.boolean().optional(),
      }),
    )
    .handler(({ context, input: { id, ...patch } }) => updateCustomer(context.tx, id, patch)),
}
