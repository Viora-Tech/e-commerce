import { loadEnv } from '@commerce/config'
import {
  checkRateLimit,
  createMemoryRateLimitStore,
  MESSAGE_CATALOGUE,
  parsePreviousSecrets,
  permissions,
  type RateLimitRule,
  rateLimitKey,
  retryAfterSeconds,
} from '@commerce/core'
import type { TemplateId } from '@commerce/notifications'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { can } from '../procedures'
import { storeRegistries } from '../services/apps.service'
import {
  notificationsOverview,
  previewMessage,
  sendTestMessage,
  setMessageOn,
} from '../services/notifications.service'

const MESSAGE_IDS = MESSAGE_CATALOGUE.map((m) => m.id) as [TemplateId, ...TemplateId[]]
const messageId = z.enum(MESSAGE_IDS)

/** A handful of test emails per store every ten minutes: enough to check each message, not a spam relay. */
const TEST_SEND_RULE: RateLimitRule = { limit: 5, windowMs: 10 * 60_000 }

/** In-process fallback, as in the store router, for hosts that don't wire a shared store. */
const fallbackRateLimit = createMemoryRateLimitStore()

export const notificationsRouter = {
  /** Settings → Notifications: every message the shop sends and how messages go out. */
  overview: can(permissions.SETTINGS_READ).handler(({ context }) =>
    notificationsOverview(context.tx, context.scope.storeId),
  ),

  /** Switch one automatic message on or off. */
  setMessage: can(permissions.SETTINGS_MANAGE)
    .input(z.object({ id: messageId, on: z.boolean() }))
    .handler(({ context, input }) =>
      setMessageOn(context.tx, context.scope.storeId, input.id, input.on),
    ),

  /** The message filled with a sample order, for the Preview dialog. Nothing is sent. */
  preview: can(permissions.SETTINGS_READ)
    .input(z.object({ id: messageId }))
    .handler(({ context, input }) => previewMessage(context.tx, context.scope.storeId, input.id)),

  /**
   * Email the sample message to the signed-in person's own address. Never to
   * anyone else, and rate limited per store.
   */
  sendTest: can(permissions.SETTINGS_MANAGE)
    .input(z.object({ id: messageId }))
    .handler(async ({ context, input }) => {
      const to = context.session.user.email
      if (!to) throw new ORPCError('BAD_REQUEST', { message: 'Your account has no email address.' })
      const limit = await checkRateLimit(
        context.rateLimit ?? fallbackRateLimit,
        rateLimitKey('notifications-send-test', context.scope.storeId),
        TEST_SEND_RULE,
      )
      if (!limit.ok) {
        throw new ORPCError('TOO_MANY_REQUESTS', {
          message: `Too many test messages. Try again in about ${Math.ceil(retryAfterSeconds(limit) / 60)} minute(s).`,
        })
      }
      const env = loadEnv(process.env)
      const { notifications } = await storeRegistries(context.tx, context.scope.storeId)
      const result = await sendTestMessage(context.tx, context.scope.storeId, {
        template: input.id,
        to,
        registry: notifications,
        secret: env.SETTINGS_SECRET,
        previousSecrets: parsePreviousSecrets(env.SETTINGS_SECRET_PREVIOUS),
      })
      return { ...result, to }
    }),
}
