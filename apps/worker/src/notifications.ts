import {
  type AppEventQueue,
  appEventForTemplate,
  deliverEmailTo,
  deliverMessageTo,
  deliverNewsletterConfirm,
  deliverNotification,
  deliverToStoreContact,
  enqueueAppEvent,
  fulfilGiftCardsForOrder,
  NOTIFICATIONS_QUEUE,
  type NotificationJob,
  notifyMembersOfNewOrder,
  storefrontOriginFor,
} from '@commerce/core'
import { registriesForStore } from '@commerce/core/registries'
import { formatInZone } from '@commerce/dates'
import { type Db, withStore } from '@commerce/db'
import { logger } from '@commerce/observability/logging'
import { applicationNotice } from '@commerce/plugin-affiliates/server'
import { getContactMessage, messageText } from '@commerce/plugin-forms/server'
import {
  loadReviewsSettings,
  questionEmailData,
  replyEmailData,
  reviewRequestEmail,
  rewardEmailData,
  rewardLabel,
} from '@commerce/plugin-reviews/server'
import { fairProcessor, type IORedis, KEEP_FINISHED, QUEUE_LIMITS, Worker } from '@commerce/queue'
import { deliverAffiliateUpdate } from './affiliates'
import { appEmailExtras } from './app-events'

/** One line per delivery attempt: template, channel and outcome, never the recipient. */
function delivery(
  template: string,
  fields: {
    storeId: string
    orderId?: string | undefined
    channel: string
    ok: boolean
    error?: string | undefined
  },
): void {
  if (fields.ok) logger.info('notification sent', { template, ...fields })
  else logger.warn('notification failed', { template, ...fields })
}

/**
 * Consumes {storeId, orderId, template} jobs. A job succeeds only when every
 * enabled channel with a recipient sent; otherwise it throws so BullMQ retries
 * with backoff, and deliverNotification skips the channels that already went.
 */
export function createNotificationWorker(
  connection: IORedis,
  db: Db,
  opts: {
    settingsSecret: string
    storefrontUrl?: string | undefined
    /** Order paid/shipped notifications double as the app lifecycle events. */
    appEvents?: AppEventQueue | undefined
    /** The admin's URL (`ADMIN_URL`): team members' new-order alerts link to the order there. */
    adminUrl?: string | undefined
  },
) {
  const { concurrency, perStore } = QUEUE_LIMITS.notifications
  return new Worker<NotificationJob>(
    NOTIFICATIONS_QUEUE,
    fairProcessor(connection, NOTIFICATIONS_QUEUE, { perStore }, async (job) => {
      const {
        storeId,
        orderId,
        template,
        key,
        returnId,
        refundId,
        shipmentId,
        signupId,
        contactMessageId,
        reviewId,
        questionId,
        affiliateId,
        affiliateNotice,
        commissionId,
        payoutId,
        custom,
        requires,
      } = job.data
      // The one message without an order: the newsletter confirm link (double opt-in).
      if (template === 'newsletter_confirm') {
        if (!signupId || !opts.storefrontUrl) return []
        const storefrontUrl = opts.storefrontUrl
        const sent = await withStore(db, storeId, async (tx) =>
          deliverNewsletterConfirm(
            { storeId, tx },
            { signupId },
            {
              registry: (await registriesForStore(tx, storeId)).notifications,
              settingsSecret: opts.settingsSecret,
              storefrontUrl,
            },
          ),
        )
        for (const r of sent) {
          delivery('newsletter_confirm', { storeId, channel: r.channel, ok: r.ok, error: r.error })
        }
        const bad = sent.filter((r) => !r.ok)
        if (bad.length > 0) throw new Error(bad.map((r) => `${r.channel}: ${r.error}`).join('; '))
        return sent
      }
      // To the merchant, no order: a message from a theme's contact or advice form (Forms app).
      if (template === 'contact_message') {
        if (!contactMessageId) return []
        const sent = await withStore(db, storeId, async (tx) => {
          const msg = await getContactMessage(tx, contactMessageId)
          if (!msg) return []
          return deliverToStoreContact(
            { storeId, tx },
            template,
            {
              contactMessage: {
                name: msg.name,
                email: msg.email,
                phone: msg.phone,
                text: messageText(msg),
                path: msg.path,
              },
            },
            {
              registry: (await registriesForStore(tx, storeId)).notifications,
              settingsSecret: opts.settingsSecret,
            },
          )
        })
        const bad = sent.filter((r) => !r.ok)
        if (bad.length > 0) throw new Error(bad.map((r) => `${r.channel}: ${r.error}`).join('; '))
        return sent
      }
      // Reviews app: the request or reminder for an order's products (email, WhatsApp or both,
      // by the store's channel), and the store's reply.
      if (template === 'review_request' || template === 'review_reminder') {
        const fallback = opts.storefrontUrl
        if (!fallback) return []
        const sent = await withStore(db, storeId, async (tx) => {
          const settings = await loadReviewsSettings(tx, storeId)
          const email = await reviewRequestEmail(
            tx,
            storeId,
            orderId,
            template === 'review_request' ? 'request' : 'reminder',
            settings,
            {
              secret: opts.settingsSecret,
              storefrontUrl: await storefrontOriginFor(tx, storeId, fallback),
            },
          )
          if (!email) return []
          return deliverMessageTo({ storeId, tx }, template, email.contact, email.data, {
            registry: (await registriesForStore(tx, storeId)).notifications,
            settingsSecret: opts.settingsSecret,
          })
        })
        const bad = sent.filter((r) => !r.ok)
        if (bad.length > 0) throw new Error(bad.map((r) => `${r.channel}: ${r.error}`).join('; '))
        return sent
      }
      // Affiliates app: to the affiliate (approved, a new sale, a payout), no order.
      if (template === 'affiliate_update') {
        if (!affiliateId || !affiliateNotice) return []
        const sent = await deliverAffiliateUpdate(db, storeId, {
          affiliateId,
          notice: affiliateNotice,
          commissionId,
          payoutId,
          settingsSecret: opts.settingsSecret,
          storefrontUrl: opts.storefrontUrl ?? '',
        })
        const bad = sent.filter((r) => !r.ok)
        if (bad.length > 0) throw new Error(bad.map((r) => `${r.channel}: ${r.error}`).join('; '))
        return sent
      }
      // Affiliates app, to the merchant: a new application waiting for approval.
      if (template === 'affiliate_application') {
        if (!affiliateId) return []
        const sent = await withStore(db, storeId, async (tx) => {
          const affiliate = await applicationNotice(tx, affiliateId, opts.adminUrl ?? '')
          if (!affiliate) return []
          return deliverToStoreContact(
            { storeId, tx },
            template,
            { affiliate },
            {
              registry: (await registriesForStore(tx, storeId)).notifications,
              settingsSecret: opts.settingsSecret,
            },
          )
        })
        const bad = sent.filter((r) => !r.ok)
        if (bad.length > 0) throw new Error(bad.map((r) => `${r.channel}: ${r.error}`).join('; '))
        return sent
      }
      if (template === 'review_reply') {
        if (!reviewId) return []
        const fallback = opts.storefrontUrl ?? ''
        const sent = await withStore(db, storeId, async (tx) => {
          const r = await replyEmailData(tx, reviewId)
          if (!r?.email || !r.reply) return []
          const base = (await storefrontOriginFor(tx, storeId, fallback)).replace(/\/+$/, '')
          return deliverEmailTo(
            { storeId, tx },
            template,
            r.email,
            {
              customerName: r.name.split(' ')[0] || 'there',
              review: {
                productTitle: r.productTitle ?? undefined,
                // A store review (no product) links the shop's home page.
                productUrl: base
                  ? r.handle
                    ? `${base}/products/${encodeURIComponent(r.handle)}#reviews`
                    : `${base}/`
                  : undefined,
                reply: r.reply,
              },
            },
            {
              registry: (await registriesForStore(tx, storeId)).notifications,
              settingsSecret: opts.settingsSecret,
            },
          )
        })
        const bad = sent.filter((r) => !r.ok)
        if (bad.length > 0) throw new Error(bad.map((r) => `${r.channel}: ${r.error}`).join('; '))
        return sent
      }
      // Reviews app: the store answered a product question and it went live (to the asker).
      if (template === 'question_answered') {
        if (!questionId) return []
        const fallback = opts.storefrontUrl ?? ''
        const sent = await withStore(db, storeId, async (tx) => {
          const q = await questionEmailData(tx, questionId)
          if (!q?.askerEmail || !q.answer || q.status !== 'published') return []
          const base = (await storefrontOriginFor(tx, storeId, fallback)).replace(/\/+$/, '')
          return deliverEmailTo(
            { storeId, tx },
            template,
            q.askerEmail,
            {
              customerName: q.askerName.split(' ')[0] || '',
              review: {
                productTitle: q.productTitle ?? undefined,
                productUrl:
                  base && q.handle
                    ? `${base}/products/${encodeURIComponent(q.handle)}#reviews`
                    : undefined,
                question: q.question,
                answer: q.answer,
              },
            },
            {
              registry: (await registriesForStore(tx, storeId)).notifications,
              settingsSecret: opts.settingsSecret,
            },
          )
        })
        const bad = sent.filter((r) => !r.ok)
        if (bad.length > 0) throw new Error(bad.map((r) => `${r.channel}: ${r.error}`).join('; '))
        return sent
      }
      // Reviews app, to the merchant: a shopper asked a product question.
      if (template === 'question_asked') {
        if (!questionId) return []
        const sent = await withStore(db, storeId, async (tx) => {
          const q = await questionEmailData(tx, questionId)
          if (!q) return []
          const admin = opts.adminUrl?.replace(/\/+$/, '')
          return deliverToStoreContact(
            { storeId, tx },
            template,
            {
              actionUrl: admin ? `${admin}/apps/reviews/questions` : undefined,
              review: {
                productTitle: q.productTitle ?? undefined,
                question: q.question,
                askerName: q.askerName || undefined,
                askerEmail: q.askerEmail ?? undefined,
              },
            },
            {
              registry: (await registriesForStore(tx, storeId)).notifications,
              settingsSecret: opts.settingsSecret,
            },
          )
        })
        const bad = sent.filter((r) => !r.ok)
        if (bad.length > 0) throw new Error(bad.map((r) => `${r.channel}: ${r.error}`).join('; '))
        return sent
      }
      // Reviews app: the photo review reward code.
      if (template === 'review_reward') {
        if (!reviewId) return []
        const fallback = opts.storefrontUrl ?? ''
        const sent = await withStore(db, storeId, async (tx) => {
          const r = await rewardEmailData(tx, reviewId)
          if (!r) return []
          const base = (await storefrontOriginFor(tx, storeId, fallback)).replace(/\/+$/, '')
          return deliverEmailTo(
            { storeId, tx },
            template,
            r.email,
            {
              customerName: r.name.split(' ')[0] || 'there',
              actionUrl: base ? `${base}/` : undefined,
              review: {
                productTitle: r.productTitle ?? undefined,
                rewardCode: r.code,
                rewardLabel: rewardLabel(r.percent),
                rewardUntil: r.endsAt
                  ? formatInZone(r.endsAt, { day: 'numeric', month: 'long', year: 'numeric' })
                  : undefined,
              },
            },
            {
              registry: (await registriesForStore(tx, storeId)).notifications,
              settingsSecret: opts.settingsSecret,
            },
          )
        })
        const bad = sent.filter((r) => !r.ok)
        if (bad.length > 0) throw new Error(bad.map((r) => `${r.channel}: ${r.error}`).join('; '))
        return sent
      }
      // Team members who asked for new-order alerts (Account → Notifications). First attempt
      // only, so a retry for the customer's own message never alerts them twice; a failure
      // here is logged and never fails the customer's job.
      if (template === 'order_placed' && job.attemptsMade === 0 && opts.adminUrl) {
        const adminUrl = opts.adminUrl
        await withStore(db, storeId, async (tx) =>
          notifyMembersOfNewOrder({ storeId, tx }, orderId, {
            registry: (await registriesForStore(tx, storeId)).notifications,
            settingsSecret: opts.settingsSecret,
            adminUrl,
          }),
        )
          .then((sent) => {
            for (const r of sent) {
              delivery('staff_new_order', {
                storeId,
                orderId,
                channel: r.channel,
                ok: r.ok,
                error: r.error,
              })
            }
          })
          .catch((err: unknown) =>
            logger.warn('new order member alert failed', { storeId, orderId, error: err }),
          )
      }
      const event = appEventForTemplate(template)
      // Queued before delivery: a channel failure retries this job, and the app
      // event's own job id makes the repeat a no-op.
      if (event && opts.appEvents) {
        await enqueueAppEvent(opts.appEvents, { storeId, event, orderId })
      }
      // A paid order that bought gift cards issues them and emails the codes. Idempotent,
      // so a retry of this job only sends codes that have not gone out yet.
      if (template === 'payment_received') {
        const cards = await withStore(db, storeId, async (tx) =>
          fulfilGiftCardsForOrder({ storeId, tx }, orderId, {
            registry: (await registriesForStore(tx, storeId)).notifications,
            secret: opts.settingsSecret,
          }),
        )
        for (const d of cards.deliveries) {
          delivery('gift_card', { storeId, orderId, channel: d.channel, ok: d.ok, error: d.error })
        }
        // A failed gift card email never blocks the order emails; the merchant can resend
        // it from the gift card page, and the next payment_received retry tries again.
      }
      const results = await withStore(db, storeId, async (tx) =>
        deliverNotification(
          { storeId, tx },
          { orderId, template, returnId, refundId, shipmentId },
          {
            registry: (await registriesForStore(tx, storeId)).notifications,
            settingsSecret: opts.settingsSecret,
            storefrontUrl: opts.storefrontUrl,
            extras: appEmailExtras(db, opts, storeId),
            // The merchant's own subject and note from the "Review email" dialog.
            data: custom ? { custom } : undefined,
            // A reminder the merchant sent by email only or WhatsApp only.
            requires,
            // A keyed job is one of several of the same template (a re-sent balance
            // request, the second reminder): send it even though the template went before.
            resend: key !== undefined,
          },
        ),
      )
      const failed = results.filter((r) => !r.ok)
      for (const r of results) {
        delivery(template, { storeId, orderId, channel: r.channel, ok: r.ok, error: r.error })
      }
      if (failed.length > 0) {
        throw new Error(failed.map((r) => `${r.channel}: ${r.error}`).join('; '))
      }
      return results
    }),
    { connection, concurrency, ...KEEP_FINISHED },
  )
}
