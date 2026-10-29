import { type Db, outboxEvent, withStore } from '@commerce/db'
import type { TemplateId } from '@commerce/notifications'
import type { LoadedPlugins } from '@commerce/plugins'
import { and, asc, eq, isNull } from 'drizzle-orm'
import { type AutomationTriggerQueue, triggerJobId } from '../automations/engine/jobs'
import { AUTOMATION_OUTBOX_TYPES } from '../automations/engine/trigger'
import { cancelAppBill, markAppBillPaid } from '../billing/app-service'
import { cancelAiTopup, markAiTopupPaid } from '../billing/credits-service'
import {
  cancelPlanBill,
  cancelUsageBill,
  markPlanBillPaid,
  markUsageBillPaid,
} from '../billing/service'
import { type DomainRouteQueue, ROUTE_JOB_ATTEMPTS, ROUTE_JOB_BACKOFF_MS } from '../domains/routes'
import { enqueueNotification, type NotificationQueue } from '../notifications/enqueue'
import { inviteForPaidPlanOrder, revokePlanInvitesForOrder } from '../onboarding/plan-invites'
import {
  PIXELS_APP_ID,
  PIXELS_OUTBOX_TYPES,
  type PixelOrderQueue,
  pixelOrderJobId,
} from '../pixels/jobs'
import {
  type AppEventQueue,
  type AppJobQueue,
  enqueueAppEvent,
  enqueueAppJob,
  installedApps,
} from '../plugins/events'
import {
  OUTBOX_APP_EVENT,
  OUTBOX_NOTIFICATION_TEMPLATE,
  type OutboxEventType,
  type OutboxPayload,
  PRODUCTS_CHANGED_JOB,
  REPEATABLE_OUTBOX_EVENTS,
} from './types'

/** What a restock row hands to whichever app wants to react (e.g. back-in-stock alerts). */
export type InventoryRestockQueue = {
  add(
    name: string,
    data: { storeId: string; variantId: string; locationId?: string | undefined },
    opts?: {
      jobId?: string
      attempts?: number
      backoff?: { type: 'exponential' | 'fixed'; delay: number }
    },
  ): Promise<unknown>
}

export type OutboxRelayDeps = {
  db: Db
  plugins: LoadedPlugins
  notifications: NotificationQueue
  /** Absent only in tests that do not exercise the app-hook fan-out. */
  appEvents?: AppEventQueue | undefined
  /** Absent only in tests that do not exercise `inventory.restocked`; that row is then just marked dispatched. */
  inventoryRestock?: InventoryRestockQueue | undefined
  /** Absent only in tests that do not exercise `domain.route_*`; those rows are then just marked dispatched. */
  domainRoutes?: DomainRouteQueue | undefined
  /** Absent only in tests that do not exercise `catalog.products_changed`; that row is then just marked dispatched. */
  appJobs?: AppJobQueue | undefined
  /** Absent only in tests that do not exercise Automations; those rows then start no runs. */
  automationTriggers?: AutomationTriggerQueue | undefined
  /** Absent only in tests that do not exercise the Pixels app; those rows then queue nothing for it. */
  pixelOrders?: PixelOrderQueue | undefined
  log?: ((message: string) => void) | undefined
  /** The platform's own sales store (`PLATFORM_SALES_STORE_ID`): paid plan orders there grant a signup invite. */
  salesStoreId?: string | undefined
}

/** The Affiliates app's events that email the affiliate, and which message each one is. */
const AFFILIATE_NOTICES: Partial<
  Record<OutboxEventType, 'approved' | 'sale' | 'payout' | 'rejected'>
> = {
  'affiliate.approved': 'approved',
  'affiliate.commission_created': 'sale',
  'affiliate.payout_paid': 'payout',
  'affiliate.rejected': 'rejected',
}

/** Rows claimed per store per tick; the next tick (or the next store) picks up the rest. */
const BATCH = 50

type Row = {
  id: string
  storeId: string
  type: string
  payload: unknown
  attempts: number
}

/**
 * Fan one row out to its consumers: at most one notification job, and one
 * app job per installed app whose manifest hooks this event. Each fan-out
 * job's id (`notificationJobId`, `appEventJobId`) already makes a repeat
 * enqueue of the same row a no-op, so a relay that dispatches a row twice
 * (crash between enqueueing and marking dispatched) never double-sends.
 */
async function dispatchRow(deps: OutboxRelayDeps, row: Row): Promise<void> {
  const type = row.type as OutboxEventType
  const payload = row.payload as OutboxPayload
  const template = OUTBOX_NOTIFICATION_TEMPLATE[type]
  // A return's own refund already told the shopper (`return_refunded`); an RTO refund is
  // merchant-only by design (see `order.rto` in OUTBOX_NOTIFICATION_TEMPLATE). Either way,
  // a refund tagged with a return is not the generic `refund_issued` message's job.
  const isReturnRefund = type === 'refund.created' && Boolean(payload.returnId)
  // The caller chose not to tell the shopper (`notifyCustomer: false` on the event).
  if (template && !isReturnRefund && payload.notifyCustomer !== false) {
    await enqueueNotification(deps.notifications, {
      storeId: row.storeId,
      orderId: payload.orderId as string,
      template,
      key: REPEATABLE_OUTBOX_EVENTS.has(type) ? row.id : undefined,
      returnId: payload.returnId,
      refundId: payload.refundId,
      custom: payload.custom,
      requires: payload.requires,
    })
  }
  const appEvent = OUTBOX_APP_EVENT[type]
  if (appEvent && deps.appEvents) {
    const installed = await installedApps(deps.db, row.storeId)
    const hooks = deps.plugins.hooksFor(appEvent, installed)
    // One job per app: a hook that throws only fails and retries its own
    // job, never one already enqueued for another app or the notification.
    for (const { pluginId } of hooks) {
      await enqueueAppEvent(deps.appEvents, {
        storeId: row.storeId,
        event: appEvent,
        orderId: payload.orderId ?? '',
        refundId: payload.refundId,
        // A customer changes many times: each change (row) is its own job.
        ...(payload.customerId ? { customerId: payload.customerId, key: row.id } : {}),
        // An order can be edited many times: each edit is its own job too.
        ...(type === 'order.edited' ? { key: row.id } : {}),
        pluginId,
      })
    }
  }
  if (type === 'order.paid' && deps.salesStoreId && row.storeId === deps.salesStoreId) {
    const r = await inviteForPaidPlanOrder(deps.db, {
      storeId: row.storeId,
      orderId: payload.orderId as string,
      salesStoreId: deps.salesStoreId,
    })
    if (r.invited) deps.log?.(`plan order ${payload.orderId}: signup invite for ${r.email}`)
    // A renewal or plan change bought from Settings → Plan & billing moves that store onto the plan.
    const billed = await markPlanBillPaid(deps.db, payload.orderId as string)
    if (billed) deps.log?.(`plan order ${payload.orderId}: plan active for store ${billed.storeId}`)
    // A month's per-order fees (or a plan bill that carried them, see createPlanBill).
    const fees = await markUsageBillPaid(deps.db, payload.orderId as string)
    if (fees) deps.log?.(`fee order ${payload.orderId}: paid for store ${fees.storeId}`)
    // A paid app bought in the App Store: its month starts and the app is installed.
    const app = await markAppBillPaid(deps.db, payload.orderId as string)
    if (app) deps.log?.(`app order ${payload.orderId}: ${app.pluginId} on for store ${app.storeId}`)
    // AI credits bought in Settings → AI.
    const topup = await markAiTopupPaid(deps.db, payload.orderId as string)
    if (topup)
      deps.log?.(`credits order ${payload.orderId}: +${topup.credits} for ${topup.storeId}`)
  }
  if (
    (type === 'refund.created' || type === 'order.cancelled') &&
    deps.salesStoreId &&
    row.storeId === deps.salesStoreId &&
    payload.orderId
  ) {
    await cancelPlanBill(deps.db, payload.orderId)
    await cancelUsageBill(deps.db, payload.orderId)
    await cancelAppBill(deps.db, payload.orderId)
    await cancelAiTopup(deps.db, payload.orderId)
    const r = await revokePlanInvitesForOrder(deps.db, {
      storeId: row.storeId,
      orderId: payload.orderId,
      salesStoreId: deps.salesStoreId,
    })
    if (r.revoked > 0)
      deps.log?.(`plan order ${payload.orderId}: ${r.revoked} signup invite(s) expired`)
    if (r.alreadyUsed > 0) {
      deps.log?.(`plan order ${payload.orderId}: refunded or cancelled after its invite was used`)
    }
  }
  if (type === 'newsletter.confirm_requested' && payload.signupId) {
    // No order to hang it on: the job carries the signup, keyed by this row so a second
    // signup (a new link) is its own job.
    await enqueueNotification(deps.notifications, {
      storeId: row.storeId,
      orderId: '',
      template: 'newsletter_confirm',
      key: row.id,
      signupId: payload.signupId,
    })
  }
  if (type === 'contact.message_received' && payload.contactMessageId) {
    // To the merchant, no order: the job carries the message (the worker reads it from the Forms app).
    await enqueueNotification(deps.notifications, {
      storeId: row.storeId,
      orderId: '',
      template: 'contact_message',
      key: row.id,
      contactMessageId: payload.contactMessageId,
    })
  }
  if (type === 'review.request_due' && payload.orderId) {
    // Reviews app: the request or its reminder for one order, keyed by this row so the
    // reminder is its own job (the worker reads the products from the app).
    await enqueueNotification(deps.notifications, {
      storeId: row.storeId,
      orderId: payload.orderId,
      template: payload.reviewRequestKind === 'reminder' ? 'review_reminder' : 'review_request',
      key: row.id,
    })
  }
  if (type === 'review.replied' && payload.reviewId) {
    await enqueueNotification(deps.notifications, {
      storeId: row.storeId,
      orderId: '',
      template: 'review_reply',
      key: row.id,
      reviewId: payload.reviewId,
    })
  }
  if (type === 'affiliate.applied' && payload.affiliateId) {
    // Affiliates app: to the merchant, no order; the worker reads the application from the app.
    await enqueueNotification(deps.notifications, {
      storeId: row.storeId,
      orderId: '',
      template: 'affiliate_application',
      key: row.id,
      affiliateId: payload.affiliateId,
    })
  }
  const affiliateNotice = AFFILIATE_NOTICES[type]
  if (affiliateNotice && payload.affiliateId) {
    // Affiliates app: to the affiliate, no order on the job; keyed by this row.
    await enqueueNotification(deps.notifications, {
      storeId: row.storeId,
      orderId: '',
      template: 'affiliate_update',
      key: row.id,
      affiliateId: payload.affiliateId,
      affiliateNotice,
      commissionId: payload.commissionId,
      payoutId: payload.payoutId,
    })
  }
  if (type === 'domain.route_requested' && payload.domainId && deps.domainRoutes) {
    await deps.domainRoutes.add(
      'add',
      {
        action: 'add',
        storeId: row.storeId,
        domainId: payload.domainId,
        ...(payload.reregister ? { reregister: true } : {}),
      },
      {
        // Keyed by the row: a re-dispatch is a no-op, a later request (new row) is its own job.
        jobId: `route-add-${row.id}`,
        attempts: ROUTE_JOB_ATTEMPTS,
        backoff: { type: 'exponential', delay: ROUTE_JOB_BACKOFF_MS },
      },
    )
  }
  if (type === 'domain.route_removed' && payload.hostname && deps.domainRoutes) {
    await deps.domainRoutes.add(
      'remove',
      { action: 'remove', storeId: row.storeId, hostname: payload.hostname },
      {
        jobId: `route-remove-${row.id}`,
        attempts: ROUTE_JOB_ATTEMPTS,
        backoff: { type: 'exponential', delay: ROUTE_JOB_BACKOFF_MS },
      },
    )
  }
  if (type === 'catalog.products_changed' && payload.productIds?.length && deps.appJobs) {
    const installed = await installedApps(deps.db, row.storeId)
    for (const pluginId of installed) {
      if (!deps.plugins.jobFor(pluginId, PRODUCTS_CHANGED_JOB, installed)) continue
      // Keyed by the row: a re-dispatch is a no-op, a later change (new row) is its own job.
      await enqueueAppJob(
        deps.appJobs,
        {
          storeId: row.storeId,
          pluginId,
          name: PRODUCTS_CHANGED_JOB,
          data: { productIds: payload.productIds },
        },
        `products-${row.id}`,
      )
    }
  }
  if (type === 'automation.order_update' && payload.orderId && payload.notificationTemplate) {
    // "Send order update": the order email the step chose, through the normal queue (it sends
    // once per template per order, so a re-dispatch or a retried step sends nothing twice).
    await enqueueNotification(deps.notifications, {
      storeId: row.storeId,
      orderId: payload.orderId,
      template: payload.notificationTemplate as TemplateId,
    })
  }
  if (AUTOMATION_OUTBOX_TYPES.has(type) && deps.automationTriggers) {
    // Keyed by the row: a re-dispatch is a no-op. The job finds the store's On workflows for
    // this type and starts runs (or nothing, when none listen).
    await deps.automationTriggers.add(
      'trigger',
      { storeId: row.storeId, outboxId: row.id },
      {
        jobId: triggerJobId(row.id),
        attempts: 5,
        backoff: { type: 'exponential', delay: 10_000 },
        removeOnComplete: true,
        removeOnFail: 1000,
      },
    )
  }
  if (PIXELS_OUTBOX_TYPES.has(type) && deps.pixelOrders) {
    // Pixels app: the server Purchase (or the owner alert for a refused token), only when the
    // store installed it. Keyed by the row, so a re-dispatch is a no-op.
    const installed = await installedApps(deps.db, row.storeId)
    if (installed.includes(PIXELS_APP_ID)) {
      await deps.pixelOrders.add(
        'order',
        { storeId: row.storeId, outboxId: row.id },
        {
          jobId: pixelOrderJobId(row.id),
          attempts: 5,
          backoff: { type: 'exponential', delay: 10_000 },
          removeOnComplete: true,
          removeOnFail: 1000,
        },
      )
    }
  }
  if (type === 'inventory.restocked' && payload.variantId && deps.inventoryRestock) {
    await deps.inventoryRestock.add(
      'restocked',
      { storeId: row.storeId, variantId: payload.variantId, locationId: payload.locationId },
      {
        // BullMQ rejects custom ids with a colon unless they have exactly three parts.
        jobId: `restock-${row.storeId}-${row.id}`,
        attempts: 5,
        backoff: { type: 'exponential', delay: 10_000 },
      },
    )
  }
}

export type RelayOutcome = { claimed: number; dispatched: number; failed: number }

/**
 * One store's undispatched rows, claimed and fanned out under a single
 * `withStore` transaction. `FOR UPDATE SKIP LOCKED` means two relay ticks (a
 * repeat schedule racing an immediate post-commit nudge, or two worker
 * processes) never claim the same row; BullMQ's own job-id dedupe is a
 * second line of defence, not the only one.
 *
 * A row whose fan-out throws keeps `dispatched_at` null with the error and
 * attempt count recorded, and the next tick retries just that row; a row
 * that fanned out fine is marked dispatched even if a later row in the same
 * batch fails, since each row's consumers are independent.
 */
export async function relayStoreOutbox(
  deps: OutboxRelayDeps,
  storeId: string,
  limit: number = BATCH,
): Promise<RelayOutcome> {
  return withStore(deps.db, storeId, async (tx) => {
    const rows = await tx
      .select()
      .from(outboxEvent)
      .where(and(eq(outboxEvent.storeId, storeId), isNull(outboxEvent.dispatchedAt)))
      .orderBy(asc(outboxEvent.createdAt))
      .limit(limit)
      .for('update', { skipLocked: true })

    let dispatched = 0
    let failed = 0
    for (const row of rows) {
      try {
        await dispatchRow(deps, row)
        await tx
          .update(outboxEvent)
          .set({ dispatchedAt: new Date(), attempts: row.attempts + 1 })
          .where(eq(outboxEvent.id, row.id))
        dispatched += 1
      } catch (err) {
        failed += 1
        const message = err instanceof Error ? err.message : String(err)
        deps.log?.(`[outbox] ${storeId}/${row.id} (${row.type}) failed: ${message}`)
        await tx
          .update(outboxEvent)
          .set({ attempts: row.attempts + 1, lastError: message.slice(0, 2000) })
          .where(eq(outboxEvent.id, row.id))
      }
    }
    return { claimed: rows.length, dispatched, failed }
  })
}
