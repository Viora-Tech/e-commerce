/** SOURCE OF TRUTH: order automation actions — WHAT: add a timeline note, hold and release fulfilment, fulfil the rest of an order, cancel it (through `cancelOrder` / `fulfilRemainingLines`), each idempotent per step and noted on the order's timeline / WHY: Flow's order steps; cancel asks before running by default (owner, Q2: the interpreter parks it), and the events the core services write carry the run's cause for the loop guard. Server-only. Design §8.4, §8.7. */
import {
  automationRun,
  automationStepRun,
  fulfillmentOrder,
  orderNote,
  type StoreTx,
} from '@commerce/db'
import { and, eq, inArray } from 'drizzle-orm'
import { CommerceError } from '../../errors'
import { fulfilRemainingLines } from '../../order/fulfil'
import { cancelOrder } from '../../order/status'
import { type ActionExecutor, type ActionPreview, AutomationActionError } from '../executor'
import {
  AUTOMATION_AUTHOR,
  gone,
  lockedOrder,
  noteOnOrder,
  orderRow,
  stampCause,
  subjectId,
} from './shared'

/** Lifecycle states an automation can no longer change. */
const CLOSED = new Set(['draft', 'cancelled'])

/** A core service refused (balance due, draft): asking again gives the same answer. */
function refused(err: unknown): never {
  if (err instanceof CommerceError && !(err instanceof AutomationActionError)) {
    throw new AutomationActionError(err.message, { retryable: false, code: err.code, cause: err })
  }
  throw err
}

// ---------------------------------------------------------------------------------------------
// Add order note
// ---------------------------------------------------------------------------------------------

type NoteConfig = { note: string }

const addNote: ActionExecutor<NoteConfig> = {
  id: 'order.add_note',
  async run({ tx, ctx, config }) {
    const orderId = subjectId(ctx, 'an order')
    if (!(await lockedOrder(tx, orderId))) throw gone('order')
    const body = ctx.render(config.note).trim()
    if (!body) return { noop: true, summary: 'The note was empty' }
    const name = ctx.workflow.name ? ` (automation ${ctx.workflow.name})` : ''
    await tx.insert(orderNote).values({
      storeId: ctx.storeId,
      orderId,
      body: `${body}${name}`.slice(0, 5000),
      author: AUTOMATION_AUTHOR,
    })
    return { summary: 'Added a note', output: { note: body } }
  },
  async preview({ ctx, config }) {
    const body = ctx.render(config.note).trim()
    return body
      ? { summary: `Would add the note "${body}"`, wouldRun: true, output: { note: body } }
      : { summary: 'The note would be empty', wouldRun: false }
  },
}

// ---------------------------------------------------------------------------------------------
// Hold / release fulfilment
// ---------------------------------------------------------------------------------------------

type HoldConfig = { reason: string }

async function parcels(tx: StoreTx, orderId: string) {
  return tx
    .select({ id: fulfillmentOrder.id, status: fulfillmentOrder.status })
    .from(fulfillmentOrder)
    .where(eq(fulfillmentOrder.orderId, orderId))
}

const hold: ActionExecutor<HoldConfig> = {
  id: 'order.hold',
  async run({ tx, ctx, config }) {
    const orderId = subjectId(ctx, 'an order')
    const o = await lockedOrder(tx, orderId)
    if (!o) throw gone('order')
    const open = (await parcels(tx, orderId)).filter((p) => p.status === 'open').map((p) => p.id)
    if (CLOSED.has(o.status) || open.length === 0) {
      return { noop: true, summary: 'Nothing left to hold', output: { heldParcelIds: [] } }
    }
    await tx
      .update(fulfillmentOrder)
      .set({ status: 'on_hold', updatedAt: new Date() })
      .where(inArray(fulfillmentOrder.id, open))
    const reason = ctx.render(config.reason ?? '').trim()
    await noteOnOrder(tx, ctx, orderId, `Fulfilment held${reason ? `: ${reason}` : ''}`)
    return {
      summary: `Held ${open.length} parcel${open.length > 1 ? 's' : ''}`,
      // Release reads these: only parcels an automation held are reopened, never a
      // pre-order parcel waiting for stock.
      output: { heldParcelIds: open, reason },
    }
  },
  async preview({ tx, ctx }) {
    const orderId = subjectId(ctx, 'an order')
    const open = (await parcels(tx, orderId)).filter((p) => p.status === 'open')
    return open.length
      ? { summary: `Would hold ${open.length} parcel${open.length > 1 ? 's' : ''}`, wouldRun: true }
      : { summary: 'Nothing left to hold', wouldRun: false }
  },
}

/** Parcels of this order still on hold that an automation's Hold step put there. */
async function heldByAutomations(tx: StoreTx, orderId: string): Promise<string[]> {
  const steps = await tx
    .select({ output: automationStepRun.output })
    .from(automationStepRun)
    .innerJoin(automationRun, eq(automationRun.id, automationStepRun.runId))
    .where(
      and(
        eq(automationStepRun.actionId, 'order.hold'),
        eq(automationStepRun.status, 'succeeded'),
        eq(automationRun.subjectType, 'order'),
        eq(automationRun.subjectId, orderId),
      ),
    )
  const ids = new Set<string>()
  for (const s of steps) {
    const held = (s.output as { heldParcelIds?: unknown } | null)?.heldParcelIds
    if (Array.isArray(held)) for (const id of held) if (typeof id === 'string') ids.add(id)
  }
  if (ids.size === 0) return []
  const still = (await parcels(tx, orderId)).filter((p) => p.status === 'on_hold' && ids.has(p.id))
  return still.map((p) => p.id)
}

const release: ActionExecutor<Record<string, never>> = {
  id: 'order.release',
  async run({ tx, ctx }) {
    const orderId = subjectId(ctx, 'an order')
    if (!(await lockedOrder(tx, orderId))) throw gone('order')
    const held = await heldByAutomations(tx, orderId)
    if (held.length === 0) {
      return { noop: true, summary: 'Nothing on hold', output: { releasedParcelIds: [] } }
    }
    await tx
      .update(fulfillmentOrder)
      .set({ status: 'open', updatedAt: new Date() })
      .where(inArray(fulfillmentOrder.id, held))
    await noteOnOrder(tx, ctx, orderId, 'Fulfilment released')
    return {
      summary: `Released ${held.length} parcel${held.length > 1 ? 's' : ''}`,
      output: { releasedParcelIds: held },
    }
  },
  async preview({ tx, ctx }) {
    const held = await heldByAutomations(tx, subjectId(ctx, 'an order'))
    return held.length
      ? { summary: `Would release ${held.length} held parcel(s)`, wouldRun: true }
      : { summary: 'Nothing an automation held', wouldRun: false }
  },
}

// ---------------------------------------------------------------------------------------------
// Fulfil
// ---------------------------------------------------------------------------------------------

type FulfilConfig = { notifyCustomer: boolean }

const NOTIFY_WARNING =
  'The shopper gets the "order shipped" message whenever it is on in Settings → Notifications.'

const fulfil: ActionExecutor<FulfilConfig> = {
  id: 'order.fulfil',
  async run({ tx, ctx }) {
    const orderId = subjectId(ctx, 'an order')
    const o = await lockedOrder(tx, orderId)
    if (!o) throw gone('order')
    if (CLOSED.has(o.status)) {
      throw new AutomationActionError(`Order #${o.number} is ${o.status}`, { retryable: false })
    }
    if (o.fulfillmentStatus !== 'unfulfilled' && o.fulfillmentStatus !== 'partially_fulfilled') {
      return { noop: true, summary: 'Already fulfilled' }
    }
    await fulfilRemainingLines({ storeId: ctx.storeId, tx }, orderId).catch(refused)
    await stampCause(tx, ctx)
    await noteOnOrder(tx, ctx, orderId, 'Marked fulfilled')
    return { summary: `Fulfilled order #${o.number}` }
  },
  async preview({ tx, ctx, config }) {
    const o = await orderRow(tx, subjectId(ctx, 'an order'))
    if (!o) return { summary: 'The order no longer exists', wouldRun: false }
    if (CLOSED.has(o.status))
      return { summary: `Order #${o.number} is ${o.status}`, wouldRun: false }
    if (o.fulfillmentStatus !== 'unfulfilled' && o.fulfillmentStatus !== 'partially_fulfilled') {
      return { summary: `Order #${o.number} is already fulfilled`, wouldRun: false }
    }
    const warnings = config.notifyCustomer === false ? [NOTIFY_WARNING] : undefined
    return { summary: `Would mark order #${o.number} fulfilled`, wouldRun: true, warnings }
  },
}

// ---------------------------------------------------------------------------------------------
// Cancel (asks before running by default: the interpreter parks the step for approval)
// ---------------------------------------------------------------------------------------------

type CancelConfig = {
  reason: 'customer' | 'fraud' | 'inventory' | 'declined' | 'other'
  notifyCustomer: boolean
  restock: boolean
}

const RESTOCK_WARNING =
  'Stock held for unpacked items always goes back on sale; packed items stay out of stock.'

function cancelWords(o: { number: number; paymentStatus: string }, config: CancelConfig): string {
  const notify = config.notifyCustomer !== false ? ' and tell the shopper' : ''
  const paid = o.paymentStatus === 'paid' ? ' Money paid online is refunded by you, not here.' : ''
  return `cancel order #${o.number}${notify}.${paid}`
}

const cancel: ActionExecutor<CancelConfig> = {
  id: 'order.cancel',
  async run({ tx, ctx, config }) {
    const orderId = subjectId(ctx, 'an order')
    const o = await lockedOrder(tx, orderId)
    if (!o) throw gone('order')
    if (o.status === 'cancelled') return { noop: true, summary: 'Already cancelled' }
    if (o.status === 'draft') {
      throw new AutomationActionError('A draft order cannot be cancelled', { retryable: false })
    }
    await cancelOrder({ storeId: ctx.storeId, tx }, orderId, {
      notifyCustomer: config.notifyCustomer !== false,
    }).catch(refused)
    await stampCause(tx, ctx)
    await noteOnOrder(tx, ctx, orderId, `Cancelled (reason: ${config.reason ?? 'other'})`)
    return {
      summary: `Cancelled order #${o.number}`,
      output: { reason: config.reason ?? 'other', notified: config.notifyCustomer !== false },
    }
  },
  async preview({ tx, ctx, config }): Promise<ActionPreview> {
    const o = await orderRow(tx, subjectId(ctx, 'an order'))
    if (!o) return { summary: 'The order no longer exists', wouldRun: false }
    if (o.status === 'cancelled') {
      return { summary: `Order #${o.number} is already cancelled`, wouldRun: false }
    }
    if (o.status === 'draft')
      return { summary: 'A draft order cannot be cancelled', wouldRun: false }
    return {
      summary: `Would ${cancelWords(o, config)}`,
      wouldRun: true,
      warnings: config.restock === false ? [RESTOCK_WARNING] : undefined,
    }
  },
}

export const orderExecutors = (): ActionExecutor<never>[] =>
  [addNote, hold, release, fulfil, cancel] as unknown as ActionExecutor<never>[]
