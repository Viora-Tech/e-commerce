import {
  type AppEventQueue,
  appEventForTemplate,
  deliverEmailTo,
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
import { type Db, withStore } from '@commerce/db'
import { getContactMessage, messageText } from '@commerce/plugin-forms/server'
import {
  loadReviewsSettings,
  replyEmailData,
  reviewRequestEmail,
} from '@commerce/plugin-reviews/server'
import { fairProcessor, type IORedis, QUEUE_LIMITS, Worker } from '@commerce/queue'
import { appEmailExtras } from './app-events'

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
        signupId,
        contactMessageId,
        reviewId,
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
          console.log(
            `[notification] newsletter_confirm ${r.channel}→${r.to} ${r.ok ? 'sent' : `failed: ${r.error}`}`,
          )
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
      // Reviews app: the request or reminder for an order's products, and the store's reply.
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
          return deliverEmailTo({ storeId, tx }, template, email.to, email.data, {
            registry: (await registriesForStore(tx, storeId)).notifications,
            settingsSecret: opts.settingsSecret,
          })
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
                productTitle: r.productTitle,
                productUrl: base
                  ? `${base}/products/${encodeURIComponent(r.handle)}#reviews`
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
              console.log(
                `[member alert] staff_new_order order=${orderId} ${r.channel}→${r.to} ${r.ok ? 'sent' : `failed: ${r.error}`}`,
              )
            }
          })
          .catch((err: unknown) => console.warn('[member alert] new order failed:', err))
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
          console.log(
            `[gift-card] order=${orderId} ${d.channel}→${d.to} ${d.ok ? 'sent' : `failed: ${d.error}`}`,
          )
        }
        // A failed gift card email never blocks the order emails; the merchant can resend
        // it from the gift card page, and the next payment_received retry tries again.
      }
      const results = await withStore(db, storeId, async (tx) =>
        deliverNotification(
          { storeId, tx },
          { orderId, template, returnId, refundId },
          {
            registry: (await registriesForStore(tx, storeId)).notifications,
            settingsSecret: opts.settingsSecret,
            storefrontUrl: opts.storefrontUrl,
            extras: appEmailExtras(db, opts, storeId),
            // A keyed job is one of several of the same template (a re-sent balance
            // request, the second reminder): send it even though the template went before.
            resend: key !== undefined,
          },
        ),
      )
      const failed = results.filter((r) => !r.ok)
      for (const r of results) {
        console.log(
          `[notification] ${template} order=${orderId} ${r.channel}→${r.to} ${r.ok ? 'sent' : `failed: ${r.error}`}`,
        )
      }
      if (failed.length > 0) {
        throw new Error(failed.map((r) => `${r.channel}: ${r.error}`).join('; '))
      }
      return results
    }),
    { connection, concurrency },
  )
}
