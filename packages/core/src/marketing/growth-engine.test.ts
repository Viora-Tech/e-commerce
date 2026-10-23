import {
  automationRun,
  automationVersion,
  automationWorkflow,
  cart,
  cartLine,
  createDb,
  customer,
  order,
  outboxEvent,
  product,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { WorkflowDefinition } from '../automations/definition'
import { cutoverStoreToEngine } from './automation-cutover'
import { mapAutomation } from './automation-engine-map'
import { automationTemplate } from './automation-steps'
import { enrolSubscriber, onOrderPlaced } from './automations'
import { createGrowthAutomation, setGrowthAutomationStatus } from './growth-automations'
import {
  type GrowthTriggerEvent,
  growthExitCheck,
  growthSweep,
  isTransactionalNode,
} from './growth-engine'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const MIN = 60_000
const DAY = 86_400_000

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

beforeEach(async () => {
  await resetDb(owner)
})

/** An engine store (cut over with nothing to copy) with the given Growth templates switched on. */
async function engineStore(slug: string, templates: string[]) {
  const [s] = await owner.insert(store).values({ slug, name: 'Waimers' }).returning()
  const storeId = s?.id as string
  const [p] = await owner
    .insert(product)
    .values({ storeId, handle: `pad-${slug}`, title: 'Glasspad', status: 'active' })
    .returning()
  const [v] = await owner
    .insert(variant)
    .values({ storeId, productId: p?.id as string, title: 'Black', pricePaise: 399900 })
    .returning()
  const ids = await withStore(app, storeId, async (tx) => {
    await cutoverStoreToEngine(tx, storeId)
    const out: Record<string, string> = {}
    for (const t of templates) {
      const w = await createGrowthAutomation(tx, storeId, t)
      await setGrowthAutomationStatus(tx, storeId, w?.id as string, 'active')
      out[t] = w?.id as string
    }
    return out
  })
  return { storeId, variantId: v?.id as string, ids }
}

async function basket(
  storeId: string,
  variantId: string,
  minutesAgo: number,
  contact: { email?: string; customerId?: string; recoverySentAt?: Date } = {},
) {
  const at = new Date(Date.now() - minutesAgo * MIN)
  const [c] = await owner
    .insert(cart)
    .values({
      storeId,
      email: contact.email ?? null,
      customerId: contact.customerId ?? null,
      customerName: 'Asha Menon',
      recoverySentAt: contact.recoverySentAt ?? null,
      updatedAt: at,
      createdAt: at,
    })
    .returning()
  await owner
    .insert(cartLine)
    .values({ storeId, cartId: c?.id as string, variantId, quantity: 1, unitPricePaise: 399900 })
  return c?.id as string
}

const recorder = () => {
  const events: GrowthTriggerEvent[] = []
  const start = async (e: GrowthTriggerEvent) => {
    events.push(e)
    return { started: [e.key] }
  }
  return { events, start }
}

describe('Growth sweeps on the engine', () => {
  it('finds quiet baskets with the old rules, once per basket key', async () => {
    const { storeId, variantId, ids } = await engineStore('sweep', [
      'abandoned_checkout',
      'abandoned_cart',
    ])
    const fresh = await basket(storeId, variantId, 61, { email: 'Asha@x.in' })
    await basket(storeId, variantId, 30, { email: 'soon@x.in' }) // not quiet for an hour yet
    await basket(storeId, variantId, 8 * 24 * 60, { email: 'old@x.in' }) // past the 7-day lookback
    await basket(storeId, variantId, 61, { email: 'nudged@x.in', recoverySentAt: new Date() })
    const [cu] = await owner
      .insert(customer)
      .values({ storeId, email: 'member@x.in', name: 'Member' })
      .returning()
    const signedIn = await basket(storeId, variantId, 121, { customerId: cu?.id as string })

    const { events, start } = recorder()
    const n = await withStore(app, storeId, (tx) =>
      growthSweep(tx, storeId, 'test-secret', new Date(), start),
    )
    expect(n).toBe(2)
    expect(events).toEqual([
      expect.objectContaining({
        triggerIds: ['checkout.abandoned'],
        key: `cart:${fresh}`,
        subject: { type: 'cart', id: fresh },
        workflowIds: [ids.abandoned_checkout],
        contact: expect.objectContaining({ cartId: fresh, email: 'asha@x.in' }),
      }),
      expect.objectContaining({
        triggerIds: ['cart.abandoned'],
        key: `cart:${signedIn}`,
        workflowIds: [ids.abandoned_cart],
        contact: expect.objectContaining({ customerId: cu?.id, email: 'member@x.in' }),
      }),
    ])
  })

  it('finds lapsed customers by their latest order, never an imported one', async () => {
    const { storeId, ids } = await engineStore('lapse', ['win_back'])
    const [a, b] = await owner
      .insert(customer)
      .values([
        { storeId, email: 'a@x.in' },
        { storeId, email: 'b@x.in' },
      ])
      .returning()
    const [o] = await owner
      .insert(order)
      .values([
        {
          storeId,
          number: 1,
          customerId: a?.id as string,
          subtotalPaise: 100,
          totalPaise: 100,
          placedAt: new Date(Date.now() - 92 * DAY),
        },
        {
          storeId,
          number: 2,
          customerId: b?.id as string,
          subtotalPaise: 100,
          totalPaise: 100,
          importedFrom: 'shopify',
          placedAt: new Date(Date.now() - 92 * DAY),
        },
      ])
      .returning()
    const { events, start } = recorder()
    await withStore(app, storeId, (tx) =>
      growthSweep(tx, storeId, 'test-secret', new Date(), start),
    )
    expect(events).toEqual([
      expect.objectContaining({
        triggerIds: ['customer.lapsed'],
        key: `lapsed:${o?.id}`,
        subject: { type: 'customer', id: a?.id },
        workflowIds: [ids.win_back],
      }),
    ])
  })

  it('sweeps nothing for Off workflows', async () => {
    const { storeId, variantId, ids } = await engineStore('off', ['abandoned_checkout'])
    await withStore(app, storeId, (tx) =>
      setGrowthAutomationStatus(tx, storeId, ids.abandoned_checkout as string, 'paused'),
    )
    await basket(storeId, variantId, 61, { email: 'asha@x.in' })
    const { events, start } = recorder()
    await withStore(app, storeId, (tx) =>
      growthSweep(tx, storeId, 'test-secret', new Date(), start),
    )
    expect(events).toHaveLength(0)
  })
})

describe('Growth exits and conversions on the engine', () => {
  async function runFor(storeId: string, workflowId: string, patch: object = {}) {
    const [w] = await owner
      .select()
      .from(automationWorkflow)
      .where(eq(automationWorkflow.id, workflowId))
    const [r] = await owner
      .insert(automationRun)
      .values({
        storeId,
        workflowId,
        versionId: w?.publishedVersionId as string,
        triggerType: w?.triggerType as string,
        triggerKey: `test:${Math.random()}`,
        subjectType: 'cart',
        status: 'waiting',
        cursor: 'whatsapp-1',
        metered: false,
        startedAt: new Date(Date.now() - DAY),
        ...patch,
      })
      .returning()
    const [v] = await owner
      .select()
      .from(automationVersion)
      .where(eq(automationVersion.id, w?.publishedVersionId as string))
    return { run: r as typeof automationRun.$inferSelect, def: v?.definition as WorkflowDefinition }
  }

  it('converts on a later order, stops when unsubscribed, converts a bought cart', async () => {
    const { storeId, variantId, ids } = await engineStore('exit', ['abandoned_checkout'])
    const [cu] = await owner
      .insert(customer)
      .values({ storeId, email: 'asha@x.in', acceptsMarketing: true })
      .returning()
    const cartId = await basket(storeId, variantId, 61, { email: 'asha@x.in' })
    const wf = ids.abandoned_checkout as string

    const plain = await runFor(storeId, wf, { customerId: cu?.id, email: 'asha@x.in', cartId })
    expect(await withStore(app, storeId, (tx) => growthExitCheck(tx, plain.run, plain.def))).toBe(
      null,
    )

    const [o] = await owner
      .insert(order)
      .values({ storeId, number: 1, email: 'Asha@x.in', subtotalPaise: 1, totalPaise: 1 })
      .returning()
    expect(
      await withStore(app, storeId, (tx) => growthExitCheck(tx, plain.run, plain.def)),
    ).toEqual({ status: 'converted', convertedOrderId: o?.id })

    // Metered (non-Growth) runs are not Growth's business.
    expect(
      await withStore(app, storeId, (tx) =>
        growthExitCheck(tx, { ...plain.run, metered: true }, plain.def),
      ),
    ).toBe(null)

    await owner.delete(order).where(eq(order.id, o?.id as string))
    await owner
      .update(customer)
      .set({ unsubscribedAt: new Date() })
      .where(eq(customer.id, cu?.id as string))
    expect(
      await withStore(app, storeId, (tx) => growthExitCheck(tx, plain.run, plain.def)),
    ).toEqual({ status: 'stopped', reason: 'unsubscribed' })

    await owner
      .update(customer)
      .set({ unsubscribedAt: null })
      .where(eq(customer.id, cu?.id as string))
    await owner.update(cart).set({ status: 'converted' }).where(eq(cart.id, cartId))
    expect(
      await withStore(app, storeId, (tx) => growthExitCheck(tx, plain.run, plain.def)),
    ).toEqual({ status: 'converted' })
  })

  it('treats only the opening COD WhatsApp as an order update', () => {
    const cod = automationTemplate('cod_confirmation')
    const m = mapAutomation({
      id: 'x',
      template: 'cod_confirmation',
      trigger: 'cod_order_placed',
      name: 'x',
      status: 'active',
      steps: [...(cod?.steps ?? []), { id: 'wait-1', type: 'wait', minutes: 60 }],
      settings: {},
    })
    const def = m?.definition as WorkflowDefinition
    expect(isTransactionalNode(def, 'whatsapp-1')).toBe(true)
    expect(isTransactionalNode(def, 'wait-1')).toBe(false)
    expect(
      isTransactionalNode({ ...def, trigger: { type: 'order.placed', config: {} } }, 'whatsapp-1'),
    ).toBe(false)
  })

  it('credits an order to open and finished runs on the engine, and fires the welcome event', async () => {
    const { storeId, ids } = await engineStore('credit', [
      'abandoned_checkout',
      'welcome_subscriber',
    ])
    const [cu] = await owner
      .insert(customer)
      .values({ storeId, email: 'asha@x.in', acceptsMarketing: true })
      .returning()
    const open = await runFor(storeId, ids.abandoned_checkout as string, {
      customerId: cu?.id,
      email: 'asha@x.in',
    })
    const done = await runFor(storeId, ids.abandoned_checkout as string, {
      customerId: cu?.id,
      status: 'completed',
      cursor: null,
    })
    const [o] = await owner
      .insert(order)
      .values({
        storeId,
        number: 1,
        customerId: cu?.id as string,
        email: 'asha@x.in',
        subtotalPaise: 1,
        totalPaise: 1,
      })
      .returning()
    const r = await withStore(app, storeId, (tx) => onOrderPlaced(tx, storeId, o?.id as string))
    expect(r).toEqual({ converted: 2, enrolled: 0 })
    const rows = await owner.select().from(automationRun).where(eq(automationRun.storeId, storeId))
    for (const id of [open.run.id, done.run.id]) {
      expect(rows.find((x) => x.id === id)).toMatchObject({
        status: 'converted',
        convertedOrderId: o?.id,
      })
    }

    await withStore(app, storeId, (tx) => enrolSubscriber(tx, storeId, 'asha@x.in', 'test-secret'))
    const events = await owner.select().from(outboxEvent).where(eq(outboxEvent.storeId, storeId))
    expect(events.filter((e) => e.type === 'customer.subscribed')).toEqual([
      expect.objectContaining({ payload: { customerId: cu?.id } }),
    ])
  })
})
