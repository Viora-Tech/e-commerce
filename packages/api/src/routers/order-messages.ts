import { loadEnv, settingsSecret } from '@commerce/config'
import {
  CommerceError,
  noteChatPaymentReminder,
  noteWhatsappChat,
  ORDER_PREVIEW_TEMPLATES,
  permissions,
  previewOrderMessage,
  REMINDER_CHANNELS,
  ReminderTooSoon,
  requestBalance,
  sendManualPaymentReminder,
  storeNotificationChannels,
  WHATSAPP_CHAT_TEMPLATES,
  whatsappChatContext,
} from '@commerce/core'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { can } from '../procedures'
import { storeRegistries } from '../services/apps.service'
import { customMessage } from './custom-message'
import { assertNotImported } from './imported-order'

/** Whether the store has a WhatsApp channel (Meta Cloud API) set up to send order messages. */
async function storeHasWhatsapp(tx: Parameters<typeof storeRegistries>[0], storeId: string) {
  const { notifications } = await storeRegistries(tx, storeId)
  const channels = await storeNotificationChannels(tx, storeId, {
    registry: notifications,
    settingsSecret: settingsSecret(),
  })
  return channels.some((c) => c.requires === 'phone')
}

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
      const whatsapp = await storeHasWhatsapp(context.tx, context.scope.storeId)
      const preview = await previewOrderMessage(
        { storeId: context.scope.storeId, tx: context.tx },
        input,
        {
          storefrontUrl: loadEnv(process.env).STOREFRONT_URL,
          settingsSecret: settingsSecret(),
          whatsapp,
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
   * "Send payment reminder" on an unpaid UPI / bank transfer order: by email, WhatsApp (when
   * set up) or both (the default), with the QR and bank details. At most once every 6 hours.
   */
  sendPaymentReminder: can(permissions.ORDERS_WRITE)
    .input(
      z.object({
        orderId: z.uuid(),
        custom: customMessage,
        channel: z.enum(REMINDER_CHANNELS).optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      await assertNotImported(context.tx, { orderId: input.orderId })
      try {
        return await sendManualPaymentReminder(
          { storeId: context.scope.storeId, tx: context.tx },
          input.orderId,
          {
            author: context.session.user.email,
            custom: input.custom,
            channel: input.channel,
            whatsapp: await storeHasWhatsapp(context.tx, context.scope.storeId),
          },
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

  /**
   * The merchant opened the payment reminder in their own WhatsApp (a wa.me chat, connected or
   * not): records it on the order timeline. Nothing is sent from the platform.
   */
  notePaymentReminderChat: can(permissions.ORDERS_WRITE)
    .input(z.object({ orderId: z.uuid() }))
    .handler(async ({ context, input }) => {
      const noted = await noteChatPaymentReminder(
        { storeId: context.scope.storeId, tx: context.tx },
        input.orderId,
        { author: context.session.user.email },
      )
      return { noted }
    }),

  /**
   * "WhatsApp" click to chat on an order, draft or abandoned checkout: the phone, names and
   * signed links the admin types the chat from. Works with no WhatsApp channel connected.
   */
  whatsappChat: can(permissions.ORDERS_READ)
    .input(z.object({ kind: z.enum(['order', 'checkout']), id: z.uuid() }))
    .handler(async ({ context, input }) => {
      const chat = await whatsappChatContext(
        { storeId: context.scope.storeId, tx: context.tx },
        input,
        { storefrontUrl: loadEnv(process.env).STOREFRONT_URL, settingsSecret: settingsSecret() },
      )
      if (!chat) throw new ORPCError('NOT_FOUND', { message: 'Not found' })
      return chat
    }),

  /**
   * The merchant opened a click-to-chat WhatsApp: "Opened WhatsApp chat (<message>)" on the
   * order's timeline (a checkout's: its customer's, when signed in). Nothing is sent from here.
   */
  noteWhatsappChat: can(permissions.ORDERS_WRITE)
    .input(
      z.object({
        kind: z.enum(['order', 'checkout']),
        id: z.uuid(),
        template: z.enum(WHATSAPP_CHAT_TEMPLATES),
      }),
    )
    .handler(async ({ context, input }) => {
      const noted = await noteWhatsappChat(
        { storeId: context.scope.storeId, tx: context.tx },
        { kind: input.kind, id: input.id },
        { template: input.template, author: context.session.user.email },
      )
      return { noted }
    }),
}
