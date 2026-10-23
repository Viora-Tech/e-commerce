import { loadEnv, settingsSecret } from '@commerce/config'
import {
  CommerceError,
  ORDER_PREVIEW_TEMPLATES,
  permissions,
  previewOrderMessage,
  ReminderTooSoon,
  requestBalance,
  sendManualPaymentReminder,
  storeNotificationChannels,
} from '@commerce/core'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { can } from '../procedures'
import { storeRegistries } from '../services/apps.service'
import { customMessage } from './custom-message'
import { assertNotImported } from './imported-order'

/** Messages staff send by hand from an order, mounted flat on `orders` (`orders.requestBalance`, ...). */
export const orderMessageRoutes = {
  /**
   * The email (and WhatsApp text) a hand-sent message would carry for this order, filled with
   * the order's own details, for the "Review email" dialog before Send. Nothing is sent.
   */
  previewMessage: can(permissions.ORDERS_READ)
    .input(
      z.object({
        orderId: z.uuid(),
        template: z.enum(ORDER_PREVIEW_TEMPLATES),
        custom: customMessage,
      }),
    )
    .handler(async ({ context, input }) => {
      // WhatsApp only shows when the store has a WhatsApp channel set up.
      const { notifications } = await storeRegistries(context.tx, context.scope.storeId)
      const channels = await storeNotificationChannels(context.tx, context.scope.storeId, {
        registry: notifications,
        settingsSecret: settingsSecret(),
      })
      const preview = await previewOrderMessage(
        { storeId: context.scope.storeId, tx: context.tx },
        input,
        {
          storefrontUrl: loadEnv(process.env).STOREFRONT_URL,
          settingsSecret: settingsSecret(),
          whatsapp: channels.some((c) => c.requires === 'phone'),
        },
      )
      if (!preview) throw new ORPCError('NOT_FOUND', { message: 'Order not found' })
      return preview
    }),

  /**
   * Ask the shopper for a deposit pre-order's balance: email and WhatsApp
   * (when set up) with a signed pay link. Can be sent again; reminders and
   * the store's unpaid-balance rule count from the first request.
   */
  requestBalance: can(permissions.ORDERS_WRITE)
    .input(z.object({ orderId: z.uuid(), custom: customMessage }))
    .handler(async ({ context, input }) => {
      await assertNotImported(context.tx, { orderId: input.orderId })
      try {
        return await requestBalance(
          { storeId: context.scope.storeId, tx: context.tx },
          input.orderId,
          { author: context.session.user.email, custom: input.custom },
        )
      } catch (err) {
        if (err instanceof CommerceError) {
          throw new ORPCError('BAD_REQUEST', { message: err.message })
        }
        throw err
      }
    }),

  /**
   * "Send payment reminder" on an unpaid UPI / bank transfer order: email, and
   * WhatsApp when set up, with the QR and bank details. At most once every 6 hours.
   */
  sendPaymentReminder: can(permissions.ORDERS_WRITE)
    .input(z.object({ orderId: z.uuid(), custom: customMessage }))
    .handler(async ({ context, input }) => {
      await assertNotImported(context.tx, { orderId: input.orderId })
      try {
        return await sendManualPaymentReminder(
          { storeId: context.scope.storeId, tx: context.tx },
          input.orderId,
          { author: context.session.user.email, custom: input.custom },
        )
      } catch (err) {
        if (err instanceof ReminderTooSoon) {
          throw new ORPCError('TOO_MANY_REQUESTS', {
            message: err.message,
            data: { nextAt: err.nextAt.toISOString() },
          })
        }
        if (err instanceof CommerceError) {
          throw new ORPCError('BAD_REQUEST', { message: err.message })
        }
        throw err
      }
    }),
}
