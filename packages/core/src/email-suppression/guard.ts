/** SOURCE OF TRUTH: withSuppressionGuard, suppressedError — WHAT: wraps a store's email channels so a send to an address on its suppression list is skipped (a failed send whose error says why, logged like any other) instead of reaching the provider / WHY: one gate on the channels covers every store send path (order messages, one-off emails, sign-in, gift cards, marketing and automations) without each caller remembering to check */
import type { EmailSuppressionReason } from '@commerce/db'
import type { NotificationChannel, SendResult, TemplateId } from '@commerce/notifications'

/** Prefix of the error a skipped send records (`notification.error`, the marketing message row). */
export const SUPPRESSED_PREFIX = 'suppressed:'

const WHY: Record<EmailSuppressionReason, string> = {
  hard_bounce: 'this address bounced',
  soft_bounces: 'this address kept bouncing',
  complaint: 'this address marked the store’s email as spam',
}

/** The failed result a suppressed send returns; never retryable, so no fallback tries it. */
export function suppressedError(reason: EmailSuppressionReason): SendResult {
  return {
    ok: false,
    error: `${SUPPRESSED_PREFIX} ${reason}: not sent because ${WHY[reason]} (Allow again on the customer page)`,
  }
}

/**
 * Sign-in codes and links still go out: the shopper is asking for one right now, and blocking it
 * would lock them out of their account.
 */
const ALWAYS_SEND: ReadonlySet<TemplateId> = new Set<TemplateId>(['login_code', 'login_link'])

/**
 * The same channels; each email channel's `send` and `sendMarketing` first look the recipient up
 * in `suppressed` (address lower case to reason, loaded once per channel set).
 */
export function withSuppressionGuard(
  channels: NotificationChannel[],
  suppressed: ReadonlyMap<string, EmailSuppressionReason>,
): NotificationChannel[] {
  if (suppressed.size === 0) return channels
  const reasonFor = (email: string | undefined) =>
    email ? suppressed.get(email.trim().toLowerCase()) : undefined
  // A proxy, not a copy: channels are class instances whose other methods need their own `this`.
  return channels.map((channel) =>
    channel.requires !== 'email'
      ? channel
      : new Proxy(channel, {
          get(target, key, receiver) {
            const value = Reflect.get(target, key, receiver)
            if (key === 'send' && typeof value === 'function') {
              const send: NotificationChannel['send'] = async (message) => {
                const reason = ALWAYS_SEND.has(message.template)
                  ? undefined
                  : reasonFor(message.to.email)
                return reason ? suppressedError(reason) : value.call(target, message)
              }
              return send
            }
            if (key === 'sendMarketing' && typeof value === 'function') {
              const sendMarketing: NonNullable<NotificationChannel['sendMarketing']> = async (
                message,
              ) => {
                const reason = message.kind === 'email' ? reasonFor(message.to.email) : undefined
                return reason ? suppressedError(reason) : value.call(target, message)
              }
              return sendMarketing
            }
            return typeof value === 'function' ? value.bind(target) : value
          },
        }),
  )
}
