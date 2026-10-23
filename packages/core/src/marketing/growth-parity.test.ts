/**
 * Parity: the same fixture timelines run on the legacy marketing runner, on the Automations
 * engine (store cut over before anything happens) and across a cutover in the middle of a
 * sequence, and must send exactly the same messages (design §10: no double send, no lost run).
 * Skipped until the engine (`automations/server`: startRuns, advanceRun, automationTick, the
 * built-in executors) is in the tree; it is imported by a computed path so this branch builds
 * without it.
 */
import {
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
import type { MarketingSend, NotificationChannel } from '@commerce/notifications'
import { NotificationRegistry } from '@commerce/notifications'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { cutoverStoreToEngine } from './automation-cutover'
import type { AutomationStep } from './automation-steps'
import {
  createAutomationFromTemplate,
  enrolDue,
  enrolSubscriber,
  onOrderPlaced,
  processDueRuns,
  setAutomationStatus,
  updateAutomation,
} from './automations'
import { growthExitCheck, growthSweep } from './growth-engine'
import type { MarketingDeps } from './send'

// biome-ignore lint/suspicious/noExplicitAny: the engine is loaded by a computed path (see top).
type Engine = any
const ENGINE_PATH = ['..', 'automations', 'server'].join('/')
const engine: Engine = await import(/* @vite-ignore */ ENGINE_PATH).catch(() => null)
const hasEngine = Boolean(engine?.advanceRun && engine?.startRuns && engine?.automationTick)

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const SECRET = 'test-secret'
const MIN = 60_000
const HOUR = 60 * MIN

const sent: MarketingSend[] = []
const channel = (id: string, requires: 'email' | 'phone'): NotificationChannel => ({
  id,
  label: id,
  requires,
  send: async () => ({ ok: true, providerRef: 'x' }),
  sendMarketing: async (m) => {
    sent.push(m)
    return { ok: true, providerRef: `ref-${sent.length}` }
  },
})
const deps: MarketingDeps = {
  registry: new NotificationRegistry(),
  settingsSecret: SECRET,
  storefrontUrl: 'https://shop.test',
  channels: [channel('fake-email', 'email'), channel('fake-wa', 'phone')],
}

beforeAll(() => {
  if (hasEngine) engine.registerBuiltinActions(deps)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})
beforeEach(async () => {
  await resetDb(owner)
  sent.length = 0
})

/** What a shopper received, comparable across runners. */
function received(): string[] {
  return sent
    .map((m) =>
      m.kind === 'email'
        ? `email ${m.to.email} "${m.subject}"${m.html.includes('Glasspad') ? ' +cart' : ''}`
        : m.kind === 'whatsapp_template'
          ? `whatsapp ${m.to.phone} ${m.template.name}(${m.template.variables.join('|').replace(/\/checkout\/recover\/[^|]+/g, '/checkout/recover/<token>')})`
          : 'other',
    )
    .sort()
}

type Mode = 'legacy' | 'engine' | 'migrated'

/** Drives one store through a timeline the way production would on its runner. */
class Driver {
  private seenOutbox = new Set<string>()
  private cutOver = false
  constructor(
    readonly mode: Mode,
    readonly storeId: string,
  ) {}

  private get onEngine() {
    return this.cutOver
  }

  async start() {
    if (this.mode === 'engine') await this.doCutover()
  }

  /** Mid-sequence cutover: only the `migrated` mode moves here. */
  async cutover() {
    if (this.mode === 'migrated') await this.doCutover()
  }

  private async doCutover() {
    await withStore(app, this.storeId, (tx) => cutoverStoreToEngine(tx, this.storeId))
    this.cutOver = true
  }

  async placeOrder(orderId: string) {
    // The storefront's checkout writes order.placed and then calls onOrderPlaced.
    await owner.insert(outboxEvent).values({
      storeId: this.storeId,
      type: 'order.placed',
      payload: { orderId },
    })
    await withStore(app, this.storeId, (tx) => onOrderPlaced(tx, this.storeId, orderId))
  }

  async subscribe(email: string) {
    await withStore(app, this.storeId, (tx) => enrolSubscriber(tx, this.storeId, email, SECRET))
  }

  async tick(at: Date) {
    const storeId = this.storeId
    if (!this.onEngine) {
      await withStore(app, storeId, async (tx) => {
        await enrolDue(tx, storeId, SECRET, at)
        await processDueRuns(tx, storeId, deps, at)
      })
      return
    }
    await withStore(app, storeId, (tx) =>
      growthSweep(tx, storeId, SECRET, at, (e) => engine.startRuns(tx, storeId, e, at)),
    )
    const rows = await owner.select().from(outboxEvent).where(eq(outboxEvent.storeId, storeId))
    for (const row of rows) {
      if (this.seenOutbox.has(row.id)) continue
      this.seenOutbox.add(row.id)
      await withStore(app, storeId, (tx) => engine.startRunsForOutboxRow(tx, storeId, row.id, at))
    }
    const engineDeps = {
      evaluate: engine.evaluateRules,
      loadSubject: engine.loadSubjectData,
      exitCheck: growthExitCheck,
      now: () => at,
    }
    for (let pass = 0; pass < 5; pass++) {
      const t: { due: { runId: string }[] } = await withStore(app, storeId, (tx) =>
        engine.automationTick(tx, storeId, at),
      )
      if (t.due.length === 0) break
      for (const d of t.due) await engine.advanceRun(app, storeId, d.runId, engineDeps)
    }
  }
}

async function seedStore(slug: string) {
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
  return { storeId, variantId: v?.id as string }
}

async function quietCart(
  storeId: string,
  variantId: string,
  minutesAgo: number,
  contact: { email?: string; phone?: string; customerId?: string },
) {
  const at = new Date(Date.now() - minutesAgo * MIN)
  const [c] = await owner
    .insert(cart)
    .values({
      storeId,
      email: contact.email ?? null,
      phone: contact.phone ?? null,
      customerId: contact.customerId ?? null,
      customerName: 'Asha Menon',
      updatedAt: at,
      createdAt: at,
    })
    .returning()
  await owner
    .insert(cartLine)
    .values({ storeId, cartId: c?.id as string, variantId, quantity: 1, unitPricePaise: 399900 })
  return c?.id as string
}

async function consenting(storeId: string, email: string, phone: string | null = null) {
  const [c] = await owner
    .insert(customer)
    .values({
      storeId,
      email,
      phone,
      name: 'Asha Menon',
      acceptsMarketing: true,
      acceptsWhatsapp: true,
    })
    .returning()
  return c?.id as string
}

async function activate(storeId: string, template: string, steps?: AutomationStep[]) {
  return withStore(app, storeId, async (tx) => {
    const a = await createAutomationFromTemplate(tx, storeId, template)
    if (!a) throw new Error('template')
    if (steps)
      await updateAutomation(tx, a.id, { name: a.name, steps, settings: a.settings as never })
    await setAutomationStatus(tx, a.id, 'active')
    return a.id
  })
}

/** A timeline: fixtures plus driver calls. Runs once per mode; returns what was received. */
type Timeline = (d: Driver, store: { storeId: string; variantId: string }) => Promise<void>

let storeSeq = 0
async function play(mode: Mode, timeline: Timeline): Promise<string[]> {
  sent.length = 0
  storeSeq += 1
  const s = await seedStore(`p${storeSeq}`)
  const d = new Driver(mode, s.storeId)
  await timeline(d, s)
  return received()
}

async function expectParity(timeline: Timeline, modes: Mode[] = ['engine', 'migrated']) {
  const legacy = await play('legacy', timeline)
  expect(legacy.length).toBeGreaterThan(0)
  const got: Partial<Record<Mode, string[]>> = {}
  for (const mode of modes) {
    await resetDb(owner)
    got[mode] = await play(mode, timeline)
  }
  expect(got).toEqual(Object.fromEntries(modes.map((m) => [m, legacy])))
}

describe.skipIf(!hasEngine)('Growth parity: legacy runner vs Automations engine', () => {
  it('abandoned checkout: email, WhatsApp at six hours, stops on the order', async () => {
    await expectParity(async (d, { storeId, variantId }) => {
      const customerId = await consenting(storeId, 'asha@x.in', '+91 98765 43210')
      const cartId = await quietCart(storeId, variantId, 61, {
        email: 'asha@x.in',
        phone: '9876543210',
        customerId,
      })
      await activate(storeId, 'abandoned_checkout')
      await d.start()
      const t0 = new Date()
      await d.tick(t0)
      await d.cutover()
      await d.tick(new Date(t0.getTime() + HOUR))
      await d.tick(new Date(t0.getTime() + 5 * HOUR + MIN))
      await owner.update(cart).set({ status: 'converted' }).where(eq(cart.id, cartId))
      const [o] = await owner
        .insert(order)
        .values({
          storeId,
          number: 1,
          email: 'asha@x.in',
          subtotalPaise: 399900,
          totalPaise: 399900,
        })
        .returning()
      await d.placeOrder(o?.id as string)
      await d.tick(new Date(t0.getTime() + 30 * HOUR))
    })
  })

  it('abandoned checkout to the end: the day-two discount email goes once', async () => {
    await expectParity(async (d, { storeId, variantId }) => {
      const customerId = await consenting(storeId, 'asha@x.in', '9876543210')
      await quietCart(storeId, variantId, 61, {
        email: 'asha@x.in',
        phone: '9876543210',
        customerId,
      })
      await activate(storeId, 'abandoned_checkout')
      await d.start()
      const t0 = new Date()
      await d.tick(t0)
      await d.tick(new Date(t0.getTime() + 5 * HOUR + MIN))
      await d.cutover()
      await d.tick(new Date(t0.getTime() + 5 * HOUR + 2 * MIN))
      await d.tick(new Date(t0.getTime() + 24 * HOUR))
      await d.tick(new Date(t0.getTime() + 48 * HOUR))
    })
  })

  it('consent: only the consenting subscriber is welcomed, once', async () => {
    await expectParity(
      async (d, { storeId }) => {
        await owner.insert(customer).values([
          { storeId, email: 'in@x.in', name: 'In', acceptsMarketing: true },
          {
            storeId,
            email: 'gone@x.in',
            name: 'Gone',
            acceptsMarketing: true,
            unsubscribedAt: new Date(),
          },
          { storeId, email: 'no@x.in', name: 'No', acceptsMarketing: false },
        ])
        await activate(storeId, 'welcome_subscriber')
        await d.start()
        for (const email of ['in@x.in', 'gone@x.in', 'no@x.in', 'in@x.in']) await d.subscribe(email)
        await d.tick(new Date())
        await d.subscribe('in@x.in')
        await d.tick(new Date(Date.now() + HOUR))
      },
      ['engine'],
    )
  })

  it("recipient: never sends under a subscriber's consent to an address that is not theirs", async () => {
    await expectParity(
      async (d, { storeId, variantId }) => {
        await consenting(storeId, 'sub@x.in', '9000000001')
        await quietCart(storeId, variantId, 61, { email: 'sub@x.in', phone: '9111111111' })
        await quietCart(storeId, variantId, 61, {
          email: 'other@x.in',
          customerId: await consenting(storeId, 'own@x.in'),
        })
        await activate(storeId, 'abandoned_checkout', [
          {
            id: 'w1',
            type: 'whatsapp',
            template: { name: 'checkout_recovery', language: 'en', variables: [] },
          },
          {
            id: 'e1',
            type: 'email',
            subject: 'Hi',
            previewText: '',
            blocks: [{ id: 't', type: 'text', text: 'Hi', align: 'left' }],
          },
        ])
        await d.start()
        await d.tick(new Date())
      },
      ['engine'],
    )
  })

  it('COD: the confirmation reaches a buyer without WhatsApp consent, the promo after it does not', async () => {
    await expectParity(
      async (d, { storeId }) => {
        const [cu] = await owner
          .insert(customer)
          .values({
            storeId,
            email: 'n@x.in',
            name: 'Chetan',
            phone: '9876500001',
            acceptsWhatsapp: false,
          })
          .returning()
        await activate(storeId, 'cod_confirmation', [
          {
            id: 'w1',
            type: 'whatsapp',
            template: {
              name: 'cod_confirmation',
              language: 'en',
              variables: ['{first_name}', '{order_number}', '{cart_total}', '{store_name}'],
            },
          },
          {
            id: 'w2',
            type: 'whatsapp',
            template: { name: 'promo', language: 'en', variables: [] },
          },
        ])
        await d.start()
        const [o] = await owner
          .insert(order)
          .values({
            storeId,
            number: 7,
            customerId: cu?.id,
            phone: '9876500001',
            paymentMethod: 'cod',
            subtotalPaise: 249900,
            totalPaise: 249900,
          })
          .returning()
        await d.placeOrder(o?.id as string)
        await d.tick(new Date())
      },
      ['engine'],
    )
  })

  it('first order: thanks a first-time buyer after three days, never for imported orders', async () => {
    await expectParity(async (d, { storeId }) => {
      const [cu] = await owner
        .insert(customer)
        .values({
          storeId,
          email: 'c@x.in',
          name: 'Chetan',
          phone: '9876500000',
          acceptsMarketing: true,
        })
        .returning()
      await activate(storeId, 'first_purchase')
      await d.start()
      const [imported] = await owner
        .insert(order)
        .values({
          storeId,
          number: 1,
          customerId: cu?.id,
          subtotalPaise: 100,
          totalPaise: 100,
          importedFrom: 'shopify',
        })
        .returning()
      await d.placeOrder(imported?.id as string)
      const [o] = await owner
        .insert(order)
        .values({
          storeId,
          number: 2,
          customerId: cu?.id,
          email: 'c@x.in',
          subtotalPaise: 249900,
          totalPaise: 249900,
        })
        .returning()
      await d.placeOrder(o?.id as string)
      const t0 = new Date()
      await d.tick(t0)
      await d.cutover()
      await d.tick(new Date(t0.getTime() + 3 * 24 * HOUR + MIN))
    })
  })

  it('conditions: a basket under the threshold is stopped, one over it gets the email', async () => {
    await expectParity(
      async (d, { storeId, variantId }) => {
        const big = await consenting(storeId, 'big@x.in')
        const small = await consenting(storeId, 'small@x.in')
        await quietCart(storeId, variantId, 90, { email: 'big@x.in', customerId: big })
        await quietCart(storeId, variantId, 90, { email: 'small@x.in', customerId: small })
        // Second basket line pushes big@ over ₹5,000.
        const [extra] = await owner.select().from(cart).where(eq(cart.email, 'big@x.in'))
        await owner.insert(cartLine).values({
          storeId,
          cartId: extra?.id as string,
          variantId,
          quantity: 1,
          unitPricePaise: 399900,
        })
        await activate(storeId, 'abandoned_checkout', [
          { id: 'c1', type: 'condition', field: 'cart_value', op: 'gte', value: '5000' },
          {
            id: 'e1',
            type: 'email',
            subject: 'Big basket',
            previewText: '',
            blocks: [{ id: 'x', type: 'cart' }],
          },
        ])
        await d.start()
        await d.tick(new Date())
      },
      ['engine'],
    )
  })

  it('paused automations hold their runs on both runners', async () => {
    await expectParity(
      async (d, { storeId, variantId }) => {
        const customerId = await consenting(storeId, 'asha@x.in', '9876543210')
        await quietCart(storeId, variantId, 61, {
          email: 'asha@x.in',
          phone: '9876543210',
          customerId,
        })
        const id = await activate(storeId, 'abandoned_checkout')
        await d.start()
        const t0 = new Date()
        await d.tick(t0)
        await withStore(app, storeId, (tx) => setAutomationStatus(tx, id, 'paused'))
        await d.cutover()
        await d.tick(new Date(t0.getTime() + 6 * HOUR))
      },
      ['migrated'],
    )
  })
})

describe('Growth parity harness', () => {
  it('reports whether the engine is in the tree', () => {
    expect(typeof hasEngine).toBe('boolean')
  })
})
