/** SOURCE OF TRUTH: order automation actions — WHAT: add a timeline note, hold and release fulfilment (`fulfillment-hold.ts`: a held order books no shipment), fulfil the rest of an order (shopper message optional), cancel it with or without restocking (through `cancelOrder` / `fulfilRemainingLines`), each idempotent per step and noted on the order's timeline / WHY: Flow's order steps; cancel asks before running by default (owner, Q2: the interpreter parks it), and the events the core services write carry the run's cause for the loop guard. Server-only. Design §8.4, §8.7. */
import { orderNote } from '@commerce/db'
import { CommerceError } from '../../errors'
import { fulfilRemainingLines } from '../../order/fulfil'
import {
  assertNotHeld,
  heldParcels,
  holdFulfillment,
  releaseFulfillment,
} from '../../order/fulfillment-hold'
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

const parcelWord = (n: number) => `${n} parcel${n > 1 ? 's' : ''}`

const hold: ActionExecutor<HoldConfig> = {
  id: 'order.hold',
  async run({ tx, ctx, config }) {
    const orderId = subjectId(ctx, 'an order')
    const o = await lockedOrder(tx, orderId)
    if (!o) throw gone('order')
    if (CLOSED.has(o.status)) return { noop: true, summary: 'Nothing left to hold' }
    const reason = ctx.render(config.reason ?? '').trim()
    const held = await holdFulfillment({ storeId: ctx.storeId, tx }, orderId, reason || null)
    if (held.length === 0) return { noop: true, summary: 'Nothing left to hold' }
    await noteOnOrder(tx, ctx, orderId, `Fulfilment held${reason ? `: ${reason}` : ''}`)
    return { summary: `Held ${parcelWord(held.length)}`, output: { heldParcelIds: held, reason } }
  },
  async preview({ tx, ctx }) {
    const orderId = subjectId(ctx, 'an order')
    const o = await orderRow(tx, orderId)
    if (!o || CLOSED.has(o.status)) return { summary: 'Nothing left to hold', wouldRun: false }
    if ((await heldParcels(tx, orderId)).length > 0) {
      return { summary: 'Already on hold', wouldRun: false }
    }
    return { summary: `Would hold order #${o.number}: no shipment until released`, wouldRun: true }
  },
}

const release: ActionExecutor<Record<string, never>> = {
  id: 'order.release',
  async run({ tx, ctx }) {
    const orderId = subjectId(ctx, 'an order')
    if (!(await lockedOrder(tx, orderId))) throw gone('order')
    const released = await releaseFulfillment({ storeId: ctx.storeId, tx }, orderId)
    if (released.length === 0) return { noop: true, summary: 'Nothing on hold' }
    await noteOnOrder(tx, ctx, orderId, 'Fulfilment released')
    return {
      summary: `Released ${parcelWord(released.length)}`,
      output: { releasedParcelIds: released },
    }
  },
  async preview({ tx, ctx }) {
    const held = await heldParcels(tx, subjectId(ctx, 'an order'))
    return held.length
      ? { summary: `Would release ${parcelWord(held.length)} on hold`, wouldRun: true }
      : { summary: 'Nothing on hold', wouldRun: false }
  },
}

// ---------------------------------------------------------------------------------------------
// Fulfil
// ---------------------------------------------------------------------------------------------

type FulfilConfig = { notifyCustomer: boolean }

const fulfil: ActionExecutor<FulfilConfig> = {
  id: 'order.fulfil',
  async run({ tx, ctx, config }) {
    const orderId = subjectId(ctx, 'an order')
    const o = await lockedOrder(tx, orderId)
    if (!o) throw gone('order')
    if (CLOSED.has(o.status)) {
      throw new AutomationActionError(`Order #${o.number} is ${o.status}`, { retryable: false })
    }
    if (o.fulfillmentStatus !== 'unfulfilled' && o.fulfillmentStatus !== 'partially_fulfilled') {
      return { noop: true, summary: 'Already fulfilled' }
    }
    const store = { storeId: ctx.storeId, tx }
    await assertNotHeld(store, orderId).catch(refused)
    await fulfilRemainingLines(store, orderId, {
      notifyCustomer: config.notifyCustomer !== false,
    }).catch(refused)
    await stampCause(tx, ctx)
    await noteOnOrder(tx, ctx, orderId, 'Marked fulfilled')
    return {
      summary: `Fulfilled order #${o.number}`,
      output: { notified: config.notifyCustomer !== false },
    }
  },
  async preview({ tx, ctx, config }) {
    const o = await orderRow(tx, subjectId(ctx, 'an order'))
    if (!o) return { summary: 'The order no longer exists', wouldRun: false }
    if (CLOSED.has(o.status))
      return { summary: `Order #${o.number} is ${o.status}`, wouldRun: false }
    if (o.fulfillmentStatus !== 'unfulfilled' && o.fulfillmentStatus !== 'partially_fulfilled') {
      return { summary: `Order #${o.number} is already fulfilled`, wouldRun: false }
    }
    if ((await heldParcels(tx, o.id)).length > 0) {
      return { summary: `Order #${o.number} is on hold`, wouldRun: false }
    }
    const notify = config.notifyCustomer === false ? ' without telling the shopper' : ''
    return { summary: `Would mark order #${o.number} fulfilled${notify}`, wouldRun: true }
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

function cancelWords(o: { number: number; paymentStatus: string }, config: CancelConfig): string {
  const notify = config.notifyCustomer !== false ? ' and tell the shopper' : ''
  const stock = config.restock === false ? ', keeping its items off sale' : ''
  const paid = o.paymentStatus === 'paid' ? ' Money paid online is refunded by you, not here.' : ''
  return `cancel order #${o.number}${stock}${notify}.${paid}`
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
      restock: config.restock !== false,
    }).catch(refused)
    await stampCause(tx, ctx)
    await noteOnOrder(tx, ctx, orderId, `Cancelled (reason: ${config.reason ?? 'other'})`)
    return {
      summary: `Cancelled order #${o.number}`,
      output: {
        reason: config.reason ?? 'other',
        notified: config.notifyCustomer !== false,
        restocked: config.restock !== false,
      },
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
    }
  },
}

export const orderExecutors = (): ActionExecutor<never>[] =>
  [addNote, hold, release, fulfil, cancel] as unknown as ActionExecutor<never>[]
