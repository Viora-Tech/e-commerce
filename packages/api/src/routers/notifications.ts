import { loadEnv } from '@commerce/config'
import {
  checkRateLimit,
  checkSenderEmail,
  createMemoryRateLimitStore,
  MESSAGE_CATALOGUE,
  parsePreviousSecrets,
  permissions,
  type RateLimitRule,
  rateLimitKey,
  removeSenderEmail,
  retryAfterSeconds,
  SenderEmailError,
  setSenderEmail,
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
import { senderEmailDeps, senderEmailOverview } from '../services/sender-email.service'

const MESSAGE_IDS = MESSAGE_CATALOGUE.map((m) => m.id) as [TemplateId, ...TemplateId[]]
const messageId = z.enum(MESSAGE_IDS)

/** A handful of test emails per store every ten minutes: enough to check each message, not a spam relay. */
const TEST_SEND_RULE: RateLimitRule = { limit: 5, windowMs: 10 * 60_000 }

/** Each new sender domain is an SES identity: a few per hour is plenty for a person, not for a script. */
const SENDER_SET_RULE: RateLimitRule = { limit: 5, windowMs: 60 * 60_000 }

/** "Check now": generous for a merchant clicking, tight enough that nobody hammers SES through us. */
const SENDER_CHECK_RULE: RateLimitRule = { limit: 12, windowMs: 10 * 60_000 }

/** In-process fallback, as in the store router, for hosts that don't wire a shared store. */
const fallbackRateLimit = createMemoryRateLimitStore()

type LimitContext = {
  rateLimit?: Parameters<typeof checkRateLimit>[0] | undefined
  scope: { storeId: string }
}

async function limitOrThrow(context: LimitContext, action: string, rule: RateLimitRule) {
  const limit = await checkRateLimit(
    context.rateLimit ?? fallbackRateLimit,
    rateLimitKey(action, context.scope.storeId),
    rule,
  )
  if (!limit.ok) {
    throw new ORPCError('TOO_MANY_REQUESTS', {
      message: `Too many tries. Try again in about ${Math.ceil(retryAfterSeconds(limit) / 60)} minute(s).`,
    })
  }
}

/** Refusals the card words itself, by `data.reason`. */
async function senderErrors<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (err instanceof SenderEmailError) {
      throw new ORPCError('BAD_REQUEST', { message: err.reason, data: { reason: err.reason } })
    }
    throw err
  }
}

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

  /** Settings → Notifications → Sender email: the address, its DNS records and what customers see. */
  senderEmail: can(permissions.SETTINGS_READ).handler(({ context }) =>
    senderEmailOverview(context.tx, context.scope.storeId),
  ),

  /**
   * Send customer emails from this address. Starts verifying its domain (one
   * domain per store, never one another store holds). Rate limited: each call
   * may create an identity in the platform's SES account.
   */
  setSenderEmail: can(permissions.SETTINGS_MANAGE)
    .input(
      z.object({
        email: z.string().trim().min(3).max(254),
        displayName: z.string().trim().max(100).nullish(),
      }),
    )
    .handler(async ({ context, input }) => {
      await limitOrThrow(context, 'sender-email-set', SENDER_SET_RULE)
      await senderErrors(() =>
        setSenderEmail(context.tx, context.scope.storeId, input, senderEmailDeps()),
      )
      return senderEmailOverview(context.tx, context.scope.storeId)
    }),

  /** "Check now": ask SES again. A domain SES gave up on starts over with fresh records. */
  checkSenderEmail: can(permissions.SETTINGS_MANAGE).handler(async ({ context }) => {
    await limitOrThrow(context, 'sender-email-check', SENDER_CHECK_RULE)
    const r = await senderErrors(() =>
      checkSenderEmail(context.tx, context.scope.storeId, {
        ...senderEmailDeps(),
        restartFailed: true,
      }),
    )
    const overview = await senderEmailOverview(context.tx, context.scope.storeId)
    return { ...overview, restarted: r?.restarted ?? false }
  }),

  /** Stop sending from the address; customer email goes back to the platform sender. */
  removeSenderEmail: can(permissions.SETTINGS_MANAGE).handler(async ({ context }) => {
    await removeSenderEmail(context.tx, senderEmailDeps())
    return senderEmailOverview(context.tx, context.scope.storeId)
  }),
}
