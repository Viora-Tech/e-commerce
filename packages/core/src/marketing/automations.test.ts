import {
  cart,
  cartLine,
  createDb,
  customer,
  marketingAutomation,
  marketingAutomationRun,
  marketingMessage,
  order,
  product,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import type { MarketingSend, NotificationChannel } from '@commerce/notifications'
import { NotificationRegistry } from '@commerce/notifications'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { AutomationStep } from './automation-steps'
import {
  automationStats,
  createAutomationFromTemplate,
  enrolDue,
  enrolSubscriber,
  onOrderPlaced,
  processDueRuns,
  setAutomationStatus,
  updateAutomation,
} from './automations'
import type { MarketingDeps } from './send'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const TEST_SECRET = 'test-secret'
const MIN = 60_000
const HOUR = 60 * MIN

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

beforeEach(async () => {
  await resetDb(owner)
})

function recorder() {
  const sent: MarketingSend[] = []
  const make = (id: string, requires: 'email' | 'phone'): NotificationChannel => ({
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
    settingsSecret: 'test-secret',
    storefrontUrl: 'https://shop.test',
    channels: [make('fake-email', 'email'), make('fake-wa', 'phone')],
  }
  return { sent, deps }
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
  contact: { email?: string; phone?: string; customerId?: string } = { email: 'asha@x.in' },
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

/** A customer who said yes to email and WhatsApp marketing. */
async function consenting(storeId: string, email = 'asha@x.in') {
  const [c] = await owner
    .insert(customer)
    .values({ storeId, email, acceptsMarketing: true, acceptsWhatsapp: true })
    .returning()
  return c?.id as string
}

async function activate(storeId: string, template: string, steps?: AutomationStep[]) {
  return withStore(app, storeId, async (tx) => {
    const a = await createAutomationFromTemplate(tx, storeId, template)
    if (!a) throw new Error('template')
    if (steps) {
      await updateAutomation(tx, a.id, {
        name: a.name,
        steps,
        settings: a.settings as never,
      })
    }
    await setAutomationStatus(tx, a.id, 'active')
    return a.id
  })
}

const tick = (storeId: string, deps: MarketingDeps, now: Date) =>
  withStore(app, storeId, async (tx) => {
    await enrolDue(tx, storeId, deps.settingsSecret, now)
    return processDueRuns(tx, storeId, deps, now)
  })

async function runOf(automationId: string) {
  const [r] = await owner
    .select()
    .from(marketingAutomationRun)
    .where(eq(marketingAutomationRun.automationId, automationId))
  return r
}

describe('abandoned checkout sequence', () => {
  it('emails at one hour, WhatsApps at six, and stops once the shopper orders', async () => {
    const { storeId, variantId } = await seedStore('a')
    const cartId = await quietCart(storeId, variantId, 61, {
      email: 'asha@x.in',
      phone: '9876543210',
      customerId: await consenting(storeId),
    })
    const id = await activate(storeId, 'abandoned_checkout')
    const { sent, deps } = recorder()

    const now = new Date()
    await tick(storeId, deps, now)
    expect(sent).toHaveLength(1)
    const first = sent[0] as Extract<MarketingSend, { kind: 'email' }>
    expect(first.to.email).toBe('asha@x.in')
    expect(first.html).toContain('Glasspad')
    expect(first.html).toContain('%2Fcheckout%2Frecover%2F')
    expect((await runOf(id))?.stepIndex).toBe(2)

    // Nothing more until the wait is over.
    await tick(storeId, deps, new Date(now.getTime() + HOUR))
    expect(sent).toHaveLength(1)

    await tick(storeId, deps, new Date(now.getTime() + 5 * HOUR + MIN))
    expect(sent).toHaveLength(2)
    expect(sent[1]).toMatchObject({
      kind: 'whatsapp_template',
      to: { phone: '919876543210' },
      template: { name: 'checkout_recovery' },
    })

    // The shopper comes back and buys: the day-two discount email never goes.
    await owner.update(cart).set({ status: 'converted' }).where(eq(cart.id, cartId))
    const [o] = await owner
      .insert(order)
      .values({ storeId, number: 1, email: 'asha@x.in', subtotalPaise: 399900, totalPaise: 399900 })
      .returning()
    const r = await withStore(app, storeId, (tx) => onOrderPlaced(tx, storeId, o?.id as string))
    expect(r.converted).toBe(1)
    await tick(storeId, deps, new Date(now.getTime() + 30 * HOUR))
    expect(sent).toHaveLength(2)
    const run = await runOf(id)
    expect(run).toMatchObject({ status: 'converted', convertedOrderId: o?.id })
    const stats = (await withStore(app, storeId, (tx) => automationStats(tx, [id]))).get(id)
    expect(stats).toMatchObject({ runs: 1, converted: 1, sent: 2, revenuePaise: 399900 })
  })

  it('stops at the next step when an order arrives between steps, even without the hook', async () => {
    const { storeId, variantId } = await seedStore('b')
    await quietCart(storeId, variantId, 61, {
      email: 'asha@x.in',
      customerId: await consenting(storeId),
    })
    const id = await activate(storeId, 'abandoned_checkout')
    const { sent, deps } = recorder()
    const now = new Date()
    await tick(storeId, deps, now)
    await owner.insert(order).values({
      storeId,
      number: 1,
      email: 'Asha@x.in',
      subtotalPaise: 100,
      totalPaise: 100,
      placedAt: new Date(now.getTime() + HOUR),
    })
    await tick(storeId, deps, new Date(now.getTime() + 25 * HOUR))
    expect(sent).toHaveLength(1)
    expect((await runOf(id))?.status).toBe('converted')
  })

  it('sends nothing to a shopper who only left a contact, without marketing consent', async () => {
    const { storeId, variantId } = await seedStore('nc')
    await quietCart(storeId, variantId, 61, { email: 'guest@x.in', phone: '9876543210' })
    const [cu] = await owner
      .insert(customer)
      .values({ storeId, email: 'buyer@x.in', acceptsMarketing: false })
      .returning()
    await quietCart(storeId, variantId, 61, { email: 'buyer@x.in', customerId: cu?.id as string })
    await activate(storeId, 'abandoned_checkout')
    const { sent, deps } = recorder()
    const now = new Date()
    await tick(storeId, deps, now)
    await tick(storeId, deps, new Date(now.getTime() + 6 * HOUR))
    expect(sent).toHaveLength(0)
  })

  it('skips baskets the old recovery sweep already nudged, and never enrols twice', async () => {
    const { storeId, variantId } = await seedStore('c')
    const nudged = await quietCart(storeId, variantId, 300)
    await owner.update(cart).set({ recoverySentAt: new Date() }).where(eq(cart.id, nudged))
    await quietCart(storeId, variantId, 90, { email: 'b@x.in' })
    await quietCart(storeId, variantId, 10, { email: 'fresh@x.in' })
    await activate(storeId, 'abandoned_checkout')
    const now = new Date()
    const first = await withStore(app, storeId, (tx) => enrolDue(tx, storeId, TEST_SECRET, now))
    const again = await withStore(app, storeId, (tx) => enrolDue(tx, storeId, TEST_SECRET, now))
    expect([first, again]).toEqual([1, 0])
  })
})

describe('consent', () => {
  it('never emails an unsubscribed customer and respects the subscribed audience', async () => {
    const { storeId } = await seedStore('d')
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
    const id = await activate(storeId, 'welcome_subscriber', [
      {
        id: 'e1',
        type: 'email',
        subject: 'Welcome',
        previewText: '',
        blocks: [{ id: 't', type: 'text', text: 'Hi {first_name}', align: 'left' }],
      },
    ])
    for (const email of ['in@x.in', 'gone@x.in', 'no@x.in']) {
      await withStore(app, storeId, (tx) => enrolSubscriber(tx, storeId, email, TEST_SECRET))
    }
    const { sent, deps } = recorder()
    await tick(storeId, deps, new Date())
    expect(sent.map((m) => (m.kind === 'email' ? m.to.email : null))).toEqual(['in@x.in'])
    const runs = await owner
      .select()
      .from(marketingAutomationRun)
      .where(eq(marketingAutomationRun.automationId, id))
    const by = Object.fromEntries(runs.map((r) => [r.email, [r.status, r.stopReason]]))
    expect(by['gone@x.in']).toEqual(['stopped', 'unsubscribed'])
    expect(by['no@x.in']).toEqual(['completed', null])
    // Signing up again does not restart the welcome.
    expect(
      await withStore(app, storeId, (tx) => enrolSubscriber(tx, storeId, 'in@x.in', TEST_SECRET)),
    ).toBe(0)
  })
})

describe('order automations', () => {
  it('confirms COD orders on WhatsApp and thanks first-time buyers, but ignores imported orders', async () => {
    const { storeId } = await seedStore('e')
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
    const cod = await activate(storeId, 'cod_confirmation')
    const first = await activate(storeId, 'first_purchase')
    const [imported] = await owner
      .insert(order)
      .values({
        storeId,
        number: 1,
        customerId: cu?.id,
        paymentMethod: 'cod',
        subtotalPaise: 100,
        totalPaise: 100,
        importedFrom: 'shopify',
      })
      .returning()
    expect(
      await withStore(app, storeId, (tx) => onOrderPlaced(tx, storeId, imported?.id as string)),
    ).toEqual({ converted: 0, enrolled: 0 })

    const [o] = await owner
      .insert(order)
      .values({
        storeId,
        number: 2,
        customerId: cu?.id,
        email: 'c@x.in',
        phone: '9876500000',
        paymentMethod: 'cod',
        subtotalPaise: 249900,
        totalPaise: 249900,
      })
      .returning()
    const r = await withStore(app, storeId, (tx) => onOrderPlaced(tx, storeId, o?.id as string))
    expect(r.enrolled).toBe(2)
    const { sent, deps } = recorder()
    await tick(storeId, deps, new Date())
    expect(sent).toEqual([
      {
        kind: 'whatsapp_template',
        to: { phone: '919876500000' },
        template: {
          name: 'cod_confirmation',
          language: 'en',
          variables: ['Chetan', '#2', '₹2,499', 'Waimers'],
        },
      },
    ])
    expect((await runOf(cod))?.status).toBe('completed')
    // The thank-you waits three days.
    expect((await runOf(first))?.status).toBe('active')
  })
})

describe('conditions and isolation', () => {
  it('stops a run whose condition fails and keeps stores apart', async () => {
    const a = await seedStore('f1')
    const b = await seedStore('f2')
    await quietCart(a.storeId, a.variantId, 90)
    const id = await activate(a.storeId, 'abandoned_checkout', [
      { id: 'c1', type: 'condition', field: 'cart_value', op: 'gte', value: '5000' },
      {
        id: 'e1',
        type: 'email',
        subject: 'Big basket',
        previewText: '',
        blocks: [{ id: 'x', type: 'cart' }],
      },
    ])
    const { sent, deps } = recorder()
    await tick(b.storeId, deps, new Date())
    expect(await owner.select().from(marketingAutomationRun)).toEqual([])
    await tick(a.storeId, deps, new Date())
    expect(sent).toEqual([])
    expect(await runOf(id)).toMatchObject({ status: 'stopped', stopReason: 'condition' })
    expect(await withStore(app, b.storeId, (tx) => tx.select().from(marketingAutomation))).toEqual(
      [],
    )
    expect(await withStore(app, b.storeId, (tx) => tx.select().from(marketingMessage))).toEqual([])
  })
})
