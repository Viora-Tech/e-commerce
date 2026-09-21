import { enqueueNotification, type TemplateId } from '@commerce/core'
import { z } from 'zod'
import { storeProcedure } from '../procedures'
import { getOrder, listOrders, setOrderStatus } from '../services/order.service'

const status = z.enum(['placed', 'paid', 'fulfilled', 'delivered', 'cancelled'])

/** Which shopper message a merchant-driven status change triggers. */
const STATUS_TEMPLATE: Partial<Record<z.infer<typeof status>, TemplateId>> = {
  paid: 'payment_received',
  fulfilled: 'order_shipped',
}

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
    .handler(async ({ context, input }) => {
      const o = await setOrderStatus(context.tx, input.id, input.status)
      const template = STATUS_TEMPLATE[input.status]
      if (o && template) {
        await enqueueNotification(context.notifications, {
          storeId: context.scope.storeId,
          orderId: o.id,
          template,
        })
      }
      return o
    }),
}
