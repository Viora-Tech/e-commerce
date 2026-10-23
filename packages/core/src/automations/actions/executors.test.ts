/** SOURCE OF TRUTH: built-in executor DB tests — WHAT: tags, notes, hold/release, cancel, metafields, collections and messages against a real store transaction, each run twice to prove idempotency / WHY: internal actions commit with their step row, so a re-run must change nothing. */
import {
  automationRun,
  automationStepRun,
  automationVersion,
  automationWorkflow,
  collection,
  collectionProduct,
  createDb,
  customer,
  fulfillmentOrder,
  location,
  marketingMessage,
  metafield,
  metafieldDefinition,
  order,
  orderNote,
  outboxEvent,
  product,
  type StoreTx,
  store,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import type { MarketingSend, NotificationChannel } from '@commerce/notifications'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createProduct } from '../../catalog/products'
import type { ActionContext, ActionExecutor, ActionResult } from '../executor'
import { builtinExecutors } from './register-builtins'
import type { BuiltinActionDeps } from './shared'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

/** A channel that records marketing sends, with an optional WhatsApp template list. */
function channel(
  id: string,
  requires: 'email' | 'phone',
  templates: { name: string; category: string; status?: string }[] = [],
) {
  const sent: MarketingSend[] = []
  const c: NotificationChannel & { sent: MarketingSend[] } = {
    id,
    label: id,
    requires,
    sent,
    async send() {
      return { ok: true, providerRef: `${id}-order` }
    },
    async sendMarketing(m) {
      sent.push(m)
      return { ok: true, providerRef: `${id}-${sent.length}` }
    },
    async listTemplates() {
      return templates.map((t) => ({
        name: t.name,
        language: 'en',
        category: t.category,
        status: t.status ?? 'APPROVED',
        body: 'Hi {{1}}',
        variableCount: 1,
      }))
    },
  }
  return c
}

const email = channel('ses', 'email')
const whatsapp = channel('meta', 'phone', [
  { name: 'order_ready', category: 'UTILITY' },
  { name: 'sale', category: 'MARKETING' },
])

function executors(): Map<string, ActionExecutor> {
  email.sent.length = 0
  whatsapp.sent.length = 0
  const deps: BuiltinActionDeps = {
    registry: {} as BuiltinActionDeps['registry'],
    settingsSecret: 'test-settings-secret',
    storefrontUrl: 'https://shop.example',
    channels: [email, whatsapp],
  }
  return new Map(builtinExecutors(deps).map((e) => [e.id, e]))
}

type World = { storeId: string; tx: StoreTx; runId: string; workflowId: string }

/** A store, inside one `withStore` transaction, with a workflow, version and run to attach steps to. */
async function inStore<T>(
  subject: (tx: StoreTx, storeId: string) => Promise<{ type: string; id: string }>,
  fn: (w: World & { subject: { type: string; id: string } }) => Promise<T>,
): Promise<T> {
  const [s] = await owner
    .insert(store)
    .values({ slug: `s${Math.random().toString(36).slice(2, 8)}`, name: 'Chai Co' })
    .returning()
  const storeId = s?.id as string
  return withStore(app, storeId, async (tx) => {
    const subj = await subject(tx, storeId)
    const [w] = await tx
      .insert(automationWorkflow)
      .values({ storeId, name: 'Test flow', triggerType: 'manual.order' })
      .returning()
    const [v] = await tx
      .insert(automationVersion)
      .values({ storeId, workflowId: w?.id as string, number: 1, definition: {} })
      .returning()
    const [r] = await tx
      .insert(automationRun)
      .values({
        storeId,
        workflowId: w?.id as string,
        versionId: v?.id as string,
        triggerType: 'manual.order',
        triggerKey: 'manual:1',
        subjectType: subj.type,
        subjectId: subj.id,
      })
      .returning()
    return fn({ storeId, tx, runId: r?.id as string, workflowId: w?.id as string, subject: subj })
  })
}

function ctxFor(
  w: World & { subject: { type: string; id: string } },
  nodeId = 'n1',
): ActionContext {
  return {
    storeId: w.storeId,
    workflow: { id: w.workflowId, name: 'Test flow', versionId: 'v' },
    runId: w.runId,
    nodeId,
    stepKey: `${w.runId}:${nodeId}:0`,
    attempt: 1,
    subject: w.subject,
    data: {},
    triggerData: {},
    cause: { runId: w.runId, workflowId: w.workflowId, depth: 1 },
    dryRun: false,
    render: (t) => t.replace('{order.number}', '7'),
    log: () => {},
  }
}

async function newCustomer(
  tx: StoreTx,
  storeId: string,
  over: Partial<typeof customer.$inferInsert> = {},
) {
  const [c] = await tx
    .insert(customer)
    .values({ storeId, email: 'asha@example.com', name: 'Asha Rao', phone: '9876543210', ...over })
    .returning()
  return c?.id as string
}

async function newOrder(
  tx: StoreTx,
  storeId: string,
  over: Partial<typeof order.$inferInsert> = {},
) {
  const [o] = await tx
    .insert(order)
    .values({
      storeId,
      number: 7,
      subtotalPaise: 100_000,
      totalPaise: 100_000,
      email: 'asha@example.com',
      phone: '9876543210',
      ...over,
    })
    .returning()
  return o?.id as string
}

const orderSubject =
  (over: Partial<typeof order.$inferInsert> = {}) =>
  async (tx: StoreTx, storeId: string) => ({
    type: 'order',
    id: await newOrder(tx, storeId, over),
  })

async function run(
  ex: Map<string, ActionExecutor>,
  id: string,
  w: Parameters<typeof ctxFor>[0],
  config: unknown,
  nodeId?: string,
): Promise<ActionResult> {
  return (ex.get(id) as ActionExecutor).run({
    tx: w.tx,
    ctx: ctxFor(w, nodeId),
    config: config as never,
  })
}

describe('tag actions', () => {
  it('adds order tags once, with a timeline note, then is a no-op', async () => {
    const ex = executors()
    await inStore(orderSubject({ tags: ['vip'] }), async (w) => {
      const first = await run(ex, 'order.add_tags', w, {
        tags: ['VIP', 'High value', 'Order {order.number}'],
      })
      expect(first).toMatchObject({ output: { tags: ['High value', 'Order 7'] } })
      const again = await run(ex, 'order.add_tags', w, { tags: ['High value'] })
      expect(again.noop).toBe(true)
      const [o] = await w.tx.select().from(order).where(eq(order.id, w.subject.id))
      expect(o?.tags).toEqual(['vip', 'High value', 'Order 7'])
      const notes = await w.tx.select().from(orderNote).where(eq(orderNote.orderId, w.subject.id))
      expect(notes).toHaveLength(1)
      expect(notes[0]?.body).toBe('Tags High value, Order 7 added by automation Test flow')
      const removed = await run(ex, 'order.remove_tags', w, { tags: ['VIP'] })
      expect(removed.output).toEqual({ tags: ['vip'] })
      expect((await run(ex, 'order.remove_tags', w, { tags: ['VIP'] })).noop).toBe(true)
    })
  })

  it("tags an order's customer lower-case and writes a loop-guarded tags_changed event", async () => {
    const ex = executors()
    await inStore(
      async (tx, storeId) => ({
        type: 'order',
        id: await newOrder(tx, storeId, { customerId: await newCustomer(tx, storeId) }),
      }),
      async (w) => {
        const r = await run(ex, 'customer.add_tags', w, { tags: ['Repeat'] })
        expect(r.changed).toHaveLength(1)
        const [c] = await w.tx.select().from(customer)
        expect(c?.tags).toEqual(['repeat'])
        const events = await w.tx
          .select()
          .from(outboxEvent)
          .where(eq(outboxEvent.type, 'customer.tags_changed'))
        expect(events[0]?.payload).toMatchObject({
          tagsAdded: ['repeat'],
          automation: { runId: w.runId, depth: 1 },
        })
        expect((await run(ex, 'customer.add_tags', w, { tags: ['REPEAT'] })).noop).toBe(true)
      },
    )
  })

  it('is a no-op on a guest order with no customer', async () => {
    const ex = executors()
    await inStore(orderSubject(), async (w) => {
      const r = await run(ex, 'customer.add_tags', w, { tags: ['x'] })
      expect(r.noop).toBe(true)
      const p = await (ex.get('customer.add_tags') as ActionExecutor).preview({
        tx: w.tx,
        ctx: ctxFor(w),
        config: { tags: ['x'] },
      })
      expect(p.wouldRun).toBe(false)
    })
  })

  it('tags a product and notes the change for search and automations', async () => {
    const ex = executors()
    await inStore(
      async (tx, storeId) => ({
        type: 'product',
        id: await createProduct(tx, storeId, {
          title: 'Tea',
          status: 'active',
          options: [],
          variants: [{ optionValues: [], pricePaise: 9_900 }],
        }),
      }),
      async (w) => {
        const p = await (ex.get('product.add_tags') as ActionExecutor).preview({
          tx: w.tx,
          ctx: ctxFor(w),
          config: { tags: ['New'] },
        })
        expect(p).toMatchObject({ wouldRun: true, summary: 'Would add tags New.' })
        await run(ex, 'product.add_tags', w, { tags: ['New'] })
        const [row] = await w.tx.select().from(product)
        expect(row?.tags).toEqual(['New'])
        const types = (await w.tx.select().from(outboxEvent)).map((e) => e.type)
        expect(types).toContain('product.updated')
        await run(ex, 'product.remove_tags', w, { tags: ['new'] })
        const [after] = await w.tx.select().from(product)
        expect(after?.tags).toEqual([])
      },
    )
  })
})

describe('order note, hold, release, cancel', () => {
  it('adds a rendered note', async () => {
    const ex = executors()
    await inStore(orderSubject(), async (w) => {
      await run(ex, 'order.add_note', w, { note: 'Check order {order.number}' })
      const [n] = await w.tx.select().from(orderNote)
      expect(n).toMatchObject({
        body: 'Check order 7 (automation Test flow)',
        author: 'automations',
      })
    })
  })

  it('holds open parcels and releases only what an automation held', async () => {
    const ex = executors()
    await inStore(orderSubject(), async (w) => {
      const [loc] = await w.tx
        .insert(location)
        .values({ storeId: w.storeId, name: 'Main' })
        .returning()
      const parcel = (position: number, status: 'open' | 'on_hold') =>
        w.tx
          .insert(fulfillmentOrder)
          .values({
            storeId: w.storeId,
            orderId: w.subject.id,
            locationId: loc?.id as string,
            position,
            status,
          })
          .returning()
      const [open] = await parcel(1, 'open')
      const [preorder] = await parcel(2, 'on_hold')
      const held = await run(ex, 'order.hold', w, { reason: 'Risky COD' }, 'hold')
      expect(held.output).toMatchObject({ heldParcelIds: [open?.id] })
      expect((await run(ex, 'order.hold', w, { reason: '' }, 'hold2')).noop).toBe(true)
      // The interpreter writes the step row with the executor's output.
      await w.tx.insert(automationStepRun).values({
        storeId: w.storeId,
        runId: w.runId,
        nodeId: 'hold',
        kind: 'action',
        actionId: 'order.hold',
        status: 'succeeded',
        output: held.output,
      })
      const released = await run(ex, 'order.release', w, {}, 'release')
      expect(released.output).toEqual({ releasedParcelIds: [open?.id] })
      const rows = await w.tx.select().from(fulfillmentOrder)
      expect(rows.find((r) => r.id === open?.id)?.status).toBe('open')
      expect(rows.find((r) => r.id === preorder?.id)?.status).toBe('on_hold')
      expect((await run(ex, 'order.release', w, {}, 'release2')).noop).toBe(true)
    })
  })

  it('cancels once, stamping the run cause on the events cancelOrder wrote', async () => {
    const ex = executors()
    await inStore(orderSubject(), async (w) => {
      const cfg = { reason: 'fraud', notifyCustomer: true, restock: true }
      const p = await (ex.get('order.cancel') as ActionExecutor).preview({
        tx: w.tx,
        ctx: ctxFor(w),
        config: cfg,
      })
      expect(p).toMatchObject({
        wouldRun: true,
        summary: 'Would cancel order #7 and tell the shopper.',
      })
      await run(ex, 'order.cancel', w, cfg)
      const [o] = await w.tx.select().from(order)
      expect(o?.status).toBe('cancelled')
      const notice = (await w.tx.select().from(outboxEvent)).find(
        (e) => e.type === 'order.cancel_notice',
      )
      expect(notice?.payload).toMatchObject({ automation: { runId: w.runId } })
      expect((await run(ex, 'order.cancel', w, cfg)).noop).toBe(true)
    })
  })

  it('fails a draft cancel without retry', async () => {
    const ex = executors()
    await inStore(orderSubject({ status: 'draft' }), async (w) => {
      await expect(run(ex, 'order.cancel', w, { reason: 'other' })).rejects.toMatchObject({
        retryable: false,
      })
    })
  })
})

describe('metafields and collections', () => {
  it('sets an order metafield through the validator, then is a no-op', async () => {
    const ex = executors()
    await inStore(orderSubject(), async (w) => {
      await w.tx.insert(metafieldDefinition).values({
        storeId: w.storeId,
        ownerType: 'order',
        namespace: 'custom',
        key: 'risk',
        name: 'Risk score',
        type: 'number_integer',
      })
      const cfg = { namespace: 'custom', key: 'risk', value: '42' }
      const r = await run(ex, 'order.set_metafield', w, cfg)
      expect(r.output).toEqual({ field: 'custom.risk', value: 42 })
      expect((await run(ex, 'order.set_metafield', w, cfg)).noop).toBe(true)
      const [m] = await w.tx.select().from(metafield)
      expect(m?.value).toBe(42)
      await expect(
        run(ex, 'order.set_metafield', w, { ...cfg, value: 'lots' }),
      ).rejects.toMatchObject({ retryable: false })
      await expect(
        run(ex, 'order.set_metafield', w, { ...cfg, key: 'nope' }),
      ).rejects.toMatchObject({ retryable: false })
    })
  })

  it('adds the product to a manual collection once and removes it', async () => {
    const ex = executors()
    await inStore(
      async (tx, storeId) => ({
        type: 'product',
        id: await createProduct(tx, storeId, {
          title: 'Tea',
          status: 'active',
          options: [],
          variants: [{ optionValues: [], pricePaise: 9_900 }],
        }),
      }),
      async (w) => {
        const [c] = await w.tx
          .insert(collection)
          .values({ storeId: w.storeId, handle: 'new', title: 'New arrivals' })
          .returning()
        const [auto] = await w.tx
          .insert(collection)
          .values({ storeId: w.storeId, handle: 'auto', title: 'Cheap', kind: 'automatic' })
          .returning()
        const cfg = { collectionId: c?.id }
        const added = await run(ex, 'collection.add_product', w, cfg)
        expect(added.changed).toEqual([{ type: 'collection', id: c?.id }])
        expect((await run(ex, 'collection.add_product', w, cfg)).noop).toBe(true)
        expect(await w.tx.select().from(collectionProduct)).toHaveLength(1)
        await run(ex, 'collection.remove_product', w, cfg)
        expect(await w.tx.select().from(collectionProduct)).toHaveLength(0)
        expect((await run(ex, 'collection.remove_product', w, cfg)).noop).toBe(true)
        await expect(
          run(ex, 'collection.add_product', w, { collectionId: auto?.id }),
        ).rejects.toMatchObject({ retryable: false })
      },
    )
  })
})

describe('messages', () => {
  it('sends a marketing WhatsApp only with consent, once per step', async () => {
    const ex = executors()
    const template = { name: 'sale', language: 'en', variables: ['{first_name}', '{order.number}'] }
    await inStore(
      async (tx, storeId) => ({
        type: 'order',
        id: await newOrder(tx, storeId, {
          customerId: await newCustomer(tx, storeId, { acceptsWhatsapp: true }),
        }),
      }),
      async (w) => {
        const r = await run(ex, 'marketing.send_whatsapp', w, { template })
        expect(r.noop).toBeFalsy()
        expect(whatsapp.sent).toEqual([
          {
            kind: 'whatsapp_template',
            to: { phone: '919876543210' },
            template: { name: 'sale', language: 'en', variables: ['Asha', '7'] },
          },
        ])
        expect((await run(ex, 'marketing.send_whatsapp', w, { template })).summary).toBe(
          'Already sent',
        )
        expect(whatsapp.sent).toHaveLength(1)
        const [m] = await w.tx.select().from(marketingMessage)
        expect(m).toMatchObject({
          status: 'sent',
          automationRunId: w.runId,
          automationNodeId: 'n1',
        })
      },
    )
  })

  it('skips marketing email without consent, sending nothing', async () => {
    const ex = executors()
    await inStore(
      async (tx, storeId) => ({ type: 'customer', id: await newCustomer(tx, storeId) }),
      async (w) => {
        const r = await run(ex, 'marketing.send_email', w, {
          subject: 'Hi',
          previewText: '',
          blocks: [],
        })
        expect(r).toMatchObject({ noop: true, output: { skipped: 'no_consent' } })
        expect(email.sent).toHaveLength(0)
      },
    )
  })

  it('sends an order update on a utility template without consent, refusing marketing ones', async () => {
    const ex = executors()
    await inStore(orderSubject(), async (w) => {
      const utility = {
        channel: 'whatsapp',
        template: { name: 'order_ready', language: 'en', variables: [] },
      }
      await run(ex, 'customer.send_order_update', w, utility)
      expect(whatsapp.sent).toHaveLength(1)
      const marketing = {
        channel: 'whatsapp',
        template: { name: 'sale', language: 'en', variables: [] },
      }
      await expect(run(ex, 'customer.send_order_update', w, marketing, 'n2')).rejects.toMatchObject(
        { retryable: false },
      )
      await expect(
        run(
          ex,
          'customer.send_order_update',
          w,
          { channel: 'email', template: 'login_code' },
          'n3',
        ),
      ).rejects.toMatchObject({ retryable: false })
    })
  })

  it('alerts staff by email once per step', async () => {
    const ex = executors()
    await inStore(orderSubject(), async (w) => {
      const cfg = {
        to: ['ops@example.com', 'owner@example.com'],
        subject: 'Order {order.number}',
        body: '<b>Big</b> one',
      }
      await run(ex, 'staff.email', w, cfg)
      expect(email.sent.map((m) => (m.kind === 'email' ? [m.to.email, m.subject] : null))).toEqual([
        ['ops@example.com', 'Order 7'],
        ['owner@example.com', 'Order 7'],
      ])
      const first = email.sent[0]
      expect(first?.kind === 'email' && first.html).toContain('&lt;b&gt;Big&lt;/b&gt;')
      expect((await run(ex, 'staff.email', w, cfg)).noop).toBe(true)
      expect(email.sent).toHaveLength(2)
    })
  })
})
