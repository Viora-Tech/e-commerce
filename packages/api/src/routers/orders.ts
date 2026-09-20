import { z } from 'zod'
import { storeProcedure } from '../procedures'
import { getOrder, listOrders, setOrderStatus } from '../services/order.service'

const status = z.enum(['placed', 'paid', 'fulfilled', 'delivered', 'cancelled'])

export const ordersRouter = {
  list: storeProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        perPage: z.number().int().min(1).max(100).default(25),
        search: z.string().trim().max(200).optional(),
        status: status.optional(),
      }),
    )
    .handler(({ context, input }) => listOrders(context.tx, input)),

  get: storeProcedure
    .input(z.object({ id: z.uuid() }))
    .handler(({ context, input }) => getOrder(context.tx, input.id)),

  setStatus: storeProcedure
    .input(z.object({ id: z.uuid(), status }))
    .handler(({ context, input }) => setOrderStatus(context.tx, input.id, input.status)),
}
