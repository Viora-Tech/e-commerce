/** SOURCE OF TRUTH: Growth's rules on the Automations engine — WHAT: the sweep triggers (checkout.abandoned, cart.abandoned, customer.lapsed), the exit check before every node of a Growth run (converted, cart bought, unsubscribed) and the order-placed conversion credit, written against the engine's seams (a `start` callback, `EngineDeps.exitCheck`) / WHY: design §10: after a store's cutover these replace `enrolDue`, the head of `processDueRuns` and `markConversions` with the same rules (7-day lookback, `recoverySentAt`, imported exclusion, 14-day window, COD transactional exception), so old and new produce the same sends. Server-only; no imports from `automations/engine/**`, so it merges independently of the engine. */
import {
  automationRun,
  automationVersion,
  automationWorkflow,
  cart,
  customer,
  type StoreTx,
} from '@commerce/db'
import { and, eq, inArray, isNull, lte, sql } from 'drizzle-orm'
import type { WorkflowDefinition } from '../automations/definition'
import { notTestCartContact } from '../cart/test-contact'
import { decryptCustomerPhone } from '../customers/phone-crypto'
import { SEND_WHATSAPP_ACTION } from './automation-engine-map'
import { CONVERSION_WINDOW_DAYS } from './automations'

const ABANDONED_LOOKBACK_DAYS = 7
const DAY_MS = 86_400_000
const SWEEP_LIMIT = 200

/** The engine's trigger event, as far as Growth's sweeps fill it (`engine/trigger.ts`). */
export type GrowthTriggerEvent = {
  triggerIds: readonly string[]
  key: string
  subject: { type: string; id: string | null }
  data: Record<string, unknown>
  cause: null
  contact: {
    customerId?: string | null
    cartId?: string | null
    orderId?: string | null
    email?: string | null
    phone?: string | null
    name?: string | null
  }
  workflowIds: readonly string[]
}

/** Starts runs for one event (the engine's `startRuns`); returns how many started. */
export type StartRuns = (event: GrowthTriggerEvent) => Promise<{ started: unknown[] }>

/** Triggers the sweep owns. Growth origin or not: any On workflow with them is swept. */
export const SWEEP_TRIGGERS = ['checkout.abandoned', 'cart.abandoned', 'customer.lapsed'] as const

async function sweepWorkflows(tx: StoreTx, triggerType: (typeof SWEEP_TRIGGERS)[number]) {
  return tx
    .select({ id: automationWorkflow.id, definition: automationVersion.definition })
    .from(automationWorkflow)
    .innerJoin(automationVersion, eq(automationVersion.id, automationWorkflow.publishedVersionId))
    .where(
      and(eq(automationWorkflow.triggerType, triggerType), eq(automationWorkflow.status, 'on')),
    )
}

const configNumber = (def: unknown, key: string, fallback: number): number => {
  const v = (def as { trigger?: { config?: Record<string, unknown> } } | null)?.trigger?.config?.[
    key
  ]
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

const lineCount = sql<number>`(select count(*)::int from cart_line cl where cl.cart_id = cart.id)`

async function customerIdByEmail(tx: StoreTx, email: string | null): Promise<string | null> {
  if (!email) return null
  const [c] = await tx
    .select({ id: customer.id })
    .from(customer)
    .where(eq(customer.email, email.trim().toLowerCase()))
  return c?.id ?? null
}

/**
 * Growth's sweeps on the engine, the same rules as `enrolDue`: quiet baskets with a checkout
 * contact (not already nudged by the old recovery sweep), signed-in shoppers' quiet carts with
 * no checkout contact, both within 7 days; customers whose latest non-imported order is
 * `lapsedDays` old (a week's window). Keys `cart:<id>` / `lapsed:<orderId>` keep every
 * basket and lapse to one run per workflow, so sweeping every tick is safe.
 */
export async function growthSweep(
  tx: StoreTx,
  _storeId: string,
  secret: string,
  now: Date,
  start: StartRuns,
): Promise<number> {
  let started = 0
  const ago = (ms: number) => new Date(now.getTime() - ms)
  const lookback = sql`${cart.updatedAt} > ${ago(ABANDONED_LOOKBACK_DAYS * DAY_MS).toISOString()}::timestamptz`

  for (const wf of await sweepWorkflows(tx, 'checkout.abandoned')) {
    const after = configNumber(wf.definition, 'afterMinutes', 60)
    const carts = await tx
      .select({
        id: cart.id,
        email: cart.email,
        phone: cart.phone,
        name: cart.customerName,
        customerId: cart.customerId,
      })
      .from(cart)
      .where(
        and(
          eq(cart.status, 'open'),
          sql`(${cart.email} is not null or ${cart.phone} is not null)`,
          notTestCartContact,
          isNull(cart.recoverySentAt),
          lte(cart.updatedAt, ago(after * 60_000)),
          lookback,
          sql`${lineCount} > 0`,
        ),
      )
      .limit(SWEEP_LIMIT)
    for (const c of carts) {
      const customerId = c.customerId ?? (await customerIdByEmail(tx, c.email))
      const r = await start({
        triggerIds: ['checkout.abandoned'],
        key: `cart:${c.id}`,
        subject: { type: 'cart', id: c.id },
        data: { cartId: c.id },
        cause: null,
        contact: {
          cartId: c.id,
          customerId,
          email: c.email?.trim().toLowerCase() || null,
          phone: c.phone,
          name: c.name,
        },
        workflowIds: [wf.id],
      })
      started += r.started.length
    }
  }

  for (const wf of await sweepWorkflows(tx, 'cart.abandoned')) {
    const after = configNumber(wf.definition, 'afterMinutes', 120)
    const carts = await tx
      .select({
        id: cart.id,
        customerId: customer.id,
        email: customer.email,
        phone: customer.phone,
        name: customer.name,
      })
      .from(cart)
      .innerJoin(customer, eq(customer.id, cart.customerId))
      .where(
        and(
          eq(cart.status, 'open'),
          isNull(cart.email),
          isNull(cart.phone),
          lte(cart.updatedAt, ago(after * 60_000)),
          lookback,
          sql`${lineCount} > 0`,
        ),
      )
      .limit(SWEEP_LIMIT)
    for (const c of carts) {
      const r = await start({
        triggerIds: ['cart.abandoned'],
        key: `cart:${c.id}`,
        subject: { type: 'cart', id: c.id },
        data: { cartId: c.id },
        cause: null,
        contact: {
          cartId: c.id,
          customerId: c.customerId,
          email: c.email?.trim().toLowerCase() || null,
          phone: decryptCustomerPhone(c.phone, secret),
          name: c.name,
        },
        workflowIds: [wf.id],
      })
      started += r.started.length
    }
  }

  const lapsedWorkflows = await sweepWorkflows(tx, 'customer.lapsed')
  if (lapsedWorkflows.length > 0) {
    // The latest order decides; an imported latest order never enrols (imported history
    // must never trigger automations).
    const latest = (await tx.execute(sql`
      select distinct on (o.customer_id) o.customer_id, o.id as order_id, c.email, c.phone, c.name,
        o.imported_from, o.placed_at
      from "order" o join customer c on c.id = o.customer_id
      where o.status not in ('draft', 'cancelled')
      order by o.customer_id, o.placed_at desc`)) as unknown as {
      customer_id: string
      order_id: string
      email: string | null
      phone: string | null
      name: string | null
      imported_from: string | null
      placed_at: string | Date
    }[]
    for (const wf of lapsedWorkflows) {
      const days = configNumber(wf.definition, 'lapsedDays', 90)
      const cutoff = ago(days * DAY_MS)
      const floor = new Date(cutoff.getTime() - 7 * DAY_MS)
      for (const r of latest) {
        const at = new Date(r.placed_at)
        if (r.imported_from || at > cutoff || at < floor) continue
        const s = await start({
          triggerIds: ['customer.lapsed'],
          key: `lapsed:${r.order_id}`,
          subject: { type: 'customer', id: r.customer_id },
          data: { customerId: r.customer_id, lastOrderId: r.order_id },
          cause: null,
          contact: {
            customerId: r.customer_id,
            email: r.email?.trim().toLowerCase() || null,
            phone: decryptCustomerPhone(r.phone, secret),
            name: r.name,
          },
          workflowIds: [wf.id],
        })
        started += s.started.length
      }
    }
  }
  return started
}

type RunRow = typeof automationRun.$inferSelect

/** The engine's exit decision (`EngineDeps.exitCheck`). */
export type GrowthExit = {
  status: 'converted' | 'stopped'
  reason?: 'unsubscribed' | undefined
  convertedOrderId?: string | null | undefined
}

/** The first order this run's shopper placed since it started (Growth's `conversionFor`). */
async function conversionFor(tx: StoreTx, run: RunRow): Promise<string | null> {
  const who = [
    run.customerId ? sql`o.customer_id = ${run.customerId}` : null,
    run.email ? sql`lower(o.email) = ${run.email}` : null,
  ].filter((x): x is NonNullable<typeof x> => x !== null)
  if (who.length === 0) return null
  const rows = (await tx.execute(sql`
    select o.id from "order" o
    where (${sql.join(who, sql` or `)})
      and o.status not in ('draft', 'cancelled') and o.imported_from is null
      and o.placed_at >= ${run.startedAt.toISOString()}::timestamptz
    order by o.placed_at limit 1`)) as unknown as { id: string }[]
  return rows[0]?.id ?? null
}

/**
 * The COD confirmation: an order update, not marketing. Same rule as `isTransactionalStep`, on
 * the tree: the workflow starts with a WhatsApp message on `order.cod_placed`.
 */
export function isTransactionalNode(def: WorkflowDefinition, nodeId: string | null): boolean {
  if (def.trigger.type !== 'order.cod_placed' || !nodeId || nodeId !== def.start) return false
  const node = def.nodes[nodeId]
  return node?.kind === 'action' && node.action === SEND_WHATSAPP_ACTION
}

/**
 * Before every node of a Growth run (the head of `processDueRuns`): a shopper who ordered since
 * the run started converts it (`exitOnOrder` workflows), a bought cart converts it, and an
 * unsubscribed customer stops it, except before the COD confirmation. Null for other
 * workflows' runs (Growth runs are the unmetered ones) and when the run goes on.
 */
export async function growthExitCheck(
  tx: StoreTx,
  run: RunRow,
  def: WorkflowDefinition,
): Promise<GrowthExit | null> {
  if (run.metered) return null
  if (def.settings.exitOnOrder) {
    const converted = await conversionFor(tx, run)
    if (converted) return { status: 'converted', convertedOrderId: converted }
  }
  if (run.customerId) {
    const [cu] = await tx
      .select({ unsubscribedAt: customer.unsubscribedAt })
      .from(customer)
      .where(eq(customer.id, run.customerId))
    if (cu?.unsubscribedAt && !isTransactionalNode(def, run.cursor)) {
      return { status: 'stopped', reason: 'unsubscribed' }
    }
  }
  if (run.cartId) {
    const [c] = await tx.select({ status: cart.status }).from(cart).where(eq(cart.id, run.cartId))
    if (c?.status === 'converted') return { status: 'converted' }
  }
  return null
}

/** Engine triggers whose Growth runs end when the shopper orders (`STOPS_ON_ORDER`). */
const CONVERTING_TRIGGERS = [
  'checkout.abandoned',
  'cart.abandoned',
  'customer.subscribed',
  'customer.lapsed',
] as const

/**
 * Growth's order-placed credit (`markConversions`) on the engine: runs this order converts (same
 * customer, email or bought cart, started before it, within 14 days), open or already
 * finished, become `converted` with the order, which feeds Growth's orders and revenue.
 */
export async function markEngineConversions(
  tx: StoreTx,
  o: { id: string; customerId: string | null; email: string | null; placedAt: Date },
  now = new Date(),
): Promise<number> {
  const since = new Date(now.getTime() - CONVERSION_WINDOW_DAYS * DAY_MS)
  const who = [
    o.customerId ? sql`${automationRun.customerId} = ${o.customerId}` : null,
    o.email ? sql`${automationRun.email} = ${o.email.trim().toLowerCase()}` : null,
    sql`${automationRun.cartId} in (select id from cart where status = 'converted')`,
  ].filter((x): x is NonNullable<typeof x> => x !== null)
  const rows = await tx
    .update(automationRun)
    .set({ status: 'converted', convertedOrderId: o.id, finishedAt: now, stopReason: null })
    .where(
      and(
        inArray(automationRun.status, ['queued', 'running', 'waiting', 'completed']),
        eq(automationRun.metered, false),
        inArray(automationRun.triggerType, [...CONVERTING_TRIGGERS]),
        sql`${automationRun.startedAt} <= ${o.placedAt.toISOString()}::timestamptz`,
        sql`${automationRun.startedAt} >= ${since.toISOString()}::timestamptz`,
        sql`(${sql.join(who, sql` or `)})`,
      ),
    )
    .returning({ id: automationRun.id })
  return rows.length
}
