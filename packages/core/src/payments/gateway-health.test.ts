/** SOURCE OF TRUTH: tests for a gateway that refused the store's keys — WHAT: the attempt is a merchant configuration error, the gateway is hidden at checkout with one owner alert per incident, the shopper's next way to pay goes on the same order (drafts switch on or off), and keys that pass a check show the gateway again / WHY: Waimers lost a week of Razorpay checkouts to rejected keys (Nov 2026) */
import {
  cart,
  cartLine,
  createDb,
  inventoryLevel,
  notification,
  order,
  orderNote,
  outboxEvent,
  payment,
  paymentGatewayHealth,
  product,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import type { MarketingSend, NotificationChannel } from '@commerce/notifications'
import type { ConnectionTestResult } from '@commerce/payments'
import { isGatewayKeysRefused, isKeysRefusedError } from '@commerce/payments'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { placeOrderAndPay } from '../order/place-order'
import { ManualPaymentProvider } from '../providers/manual'
import { FakePaymentProvider } from '../providers/payment'
import { deliverGatewayAlertRow } from './gateway-alert'
import { GatewayDouble } from './gateway-double.test-util'
import { hiddenGateways, markGatewayHealthy } from './gateway-health'
import { queuePaymentPendingNudges } from './pending-nudge'

/** The cool-down `gateway-health.ts` keeps a refused gateway hidden for. */
const GATEWAY_RETEST_MS = 10 * 60_000

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})
beforeEach(async () => {
  await resetDb(owner)
})

/** What Razorpay's SDK rejects with when it refuses the key id and secret. */
const AUTH_FAILED = {
  statusCode: 401,
  error: { code: 'BAD_REQUEST_ERROR', description: 'Authentication failed' },
}

/** A gateway whose keys are refused, with the read-only key check the re-test runs. */
class RefusingGateway extends GatewayDouble {
  keysWork = false
  checks = 0
  async testConnection(): Promise<ConnectionTestResult> {
    this.checks++
    return this.keysWork ? { ok: true, message: 'ok' } : { ok: false, message: 'refused' }
  }
  refuseNext() {
    this.rejectNextWith = AUTH_FAILED
    return this
  }
}

const transfer = new ManualPaymentProvider({ upiId: 'shop@hdfcbank', payeeName: 'Shop' })
const cod = () => new FakePaymentProvider({ mode: 'capture', id: 'cod' })

type Shop = { storeId: string; keyboard: string }

async function seedShop(drafts: 'on' | 'off'): Promise<Shop> {
  const [s] = await owner
    .insert(store)
    .values({ slug: 'waimers', name: 'Waimers', payments: { unpaidAsDrafts: drafts } })
    .returning()
  if (!s) throw new Error('seed')
  const [p] = await owner
    .insert(product)
    .values({ storeId: s.id, handle: 'wooting', title: 'Wooting 80HE', status: 'active' })
    .returning()
  if (!p) throw new Error('seed')
  const [v] = await owner
    .insert(variant)
    .values({ storeId: s.id, productId: p.id, title: 'Wooting 80HE', pricePaise: 2689900 })
    .returning()
  if (!v) throw new Error('seed')
  await owner.insert(inventoryLevel).values({ storeId: s.id, variantId: v.id, onHand: 10 })
  return { storeId: s.id, keyboard: v.id }
}

async function cartWith(shop: Shop) {
  const [c] = await owner.insert(cart).values({ storeId: shop.storeId }).returning()
  if (!c) throw new Error('seed')
  await owner.insert(cartLine).values({
    storeId: shop.storeId,
    cartId: c.id,
    variantId: shop.keyboard,
    quantity: 1,
    unitPricePaise: 2689900,
  })
  return c.id
}

const checkout = (email = 'rudra@example.com') => ({
  name: 'Shopper',
  email,
  phone: email === 'rudra@example.com' ? '9876543210' : '9876500000',
  address: { line1: '12 MG Road', city: 'Bengaluru', stateCode: 'KA', pincode: '560001' },
})

const pay = (
  shop: Shop,
  cartId: string,
  provider: GatewayDouble | ManualPaymentProvider | FakePaymentProvider,
  email?: string,
) =>
  placeOrderAndPay(app, shop.storeId, {
    cartId,
    paymentProvider: provider,
    checkout: checkout(email),
  })

const orders = (storeId: string) => owner.select().from(order).where(eq(order.storeId, storeId))
const alerts = () =>
  owner.select().from(outboxEvent).where(eq(outboxEvent.type, 'payments.gateway_keys_refused'))
const reserved = async (variantId: string) =>
  (await owner.select().from(inventoryLevel).where(eq(inventoryLevel.variantId, variantId)))[0]
    ?.reserved
const hidden = (storeId: string, providers: GatewayDouble[], now?: Date) =>
  withStore(app, storeId, (tx) => hiddenGateways(tx, storeId, providers, now))

describe('refused gateway keys', () => {
  it('reads Razorpay 401s as refused keys, and nothing the shopper did', () => {
    expect(isGatewayKeysRefused(AUTH_FAILED)).toBe(true)
    expect(
      isGatewayKeysRefused({ statusCode: 400, error: { description: 'Authentication failed' } }),
    ).toBe(true)
    expect(isGatewayKeysRefused(new Error('gateway timeout'))).toBe(false)
    expect(
      isGatewayKeysRefused({ statusCode: 400, error: { description: 'amount too low' } }),
    ).toBe(false)
  })

  for (const drafts of ['off', 'on'] as const) {
    describe(`with unpaid checkouts as drafts ${drafts}`, () => {
      it('hides the gateway, alerts the owner once and takes the next way to pay on the same order', async () => {
        const shop = await seedShop(drafts)
        const gw = new RefusingGateway().refuseNext()
        const cartId = await cartWith(shop)

        const first = await pay(shop, cartId, gw)
        expect(first.keysRefused).toBe(true)
        expect(first.session).toBeNull()
        const [failed] = await owner
          .select()
          .from(payment)
          .where(eq(payment.orderId, first.orderId))
        expect(failed?.status).toBe('failed')
        expect(isKeysRefusedError(failed?.error)).toBe(true)
        expect(failed?.error).toContain('Authentication failed')
        expect(await hidden(shop.storeId, [gw])).toEqual(new Set(['gw']))
        expect(gw.checks).toBe(0) // still in its cool-down: not checked again yet
        expect(await alerts()).toHaveLength(1)
        // No "retry your payment" email for a failure the shopper cannot fix.
        await withStore(app, shop.storeId, (tx) =>
          queuePaymentPendingNudges(
            { storeId: shop.storeId, tx },
            new Date(Date.now() + 3_600_000),
          ),
        )
        expect(
          await owner
            .select()
            .from(outboxEvent)
            .where(eq(outboxEvent.type, 'order.payment_pending')),
        ).toHaveLength(0)

        // Another shopper hits the same broken keys: still one alert for this incident.
        const other = await pay(
          shop,
          await cartWith(shop),
          new RefusingGateway().refuseNext(),
          'x@example.com',
        )
        expect(other.keysRefused).toBe(true)
        expect(await alerts()).toHaveLength(1)

        // The shopper picks UPI to the shop's account: the same order, no second one, stock held once.
        const again = await pay(shop, cartId, transfer)
        expect(again.orderId).toBe(first.orderId)
        expect(again.orderNumber).toBe(first.orderNumber)
        expect(again.draftNumber).toBe(first.draftNumber)
        expect(again.keysRefused).toBe(false)
        expect(again.session?.kind).toBe('manual')
        const rows = await orders(shop.storeId)
        expect(rows).toHaveLength(2) // this shopper's and the other shopper's, nothing more
        const row = rows.find((r) => r.id === first.orderId)
        expect(row?.paymentMethod).toBe('manual')
        expect(row?.status).toBe(drafts === 'on' ? 'draft' : 'open')
        expect(await reserved(shop.keyboard)).toBe(2)
        const notes = await owner
          .select()
          .from(orderNote)
          .where(eq(orderNote.orderId, first.orderId))
        expect(notes.some((n) => n.body.includes('rejected the store'))).toBe(true)
        // A second submit of that cart is a replay of the transfer order, never a new one.
        const replay = await pay(shop, cartId, transfer)
        expect(replay.orderId).toBe(first.orderId)
        expect(replay.replayed).toBe(true)
      })

      it('turns the checkout into a cash on delivery order in place', async () => {
        const shop = await seedShop(drafts)
        const cartId = await cartWith(shop)
        const first = await pay(shop, cartId, new RefusingGateway().refuseNext())
        const again = await pay(shop, cartId, cod())
        expect(again.orderId).toBe(first.orderId)
        const [row] = await owner.select().from(order).where(eq(order.id, first.orderId))
        expect(row?.status).toBe('open')
        expect(row?.paymentMethod).toBe('cod')
        expect(row?.draftReserved).toBeNull()
        expect(await orders(shop.storeId)).toHaveLength(1)
        expect(await reserved(shop.keyboard)).toBe(1)
        if (drafts === 'off') expect(again.orderNumber).toBe(first.orderNumber)
      })
    })
  }

  it('shows the gateway again once its keys pass the check after the cool-down', async () => {
    const shop = await seedShop('off')
    const gw = new RefusingGateway().refuseNext()
    await pay(shop, await cartWith(shop), gw)
    const later = new Date(Date.now() + GATEWAY_RETEST_MS + 1000)

    // Still refused: hidden for another cool-down, checked by one request only.
    expect(await hidden(shop.storeId, [gw], later)).toEqual(new Set(['gw']))
    expect(await hidden(shop.storeId, [gw], later)).toEqual(new Set(['gw']))
    expect(gw.checks).toBe(1)

    gw.keysWork = true
    const muchLater = new Date(later.getTime() + GATEWAY_RETEST_MS + 1000)
    expect(await hidden(shop.storeId, [gw], muchLater)).toEqual(new Set())
    const [row] = await owner.select().from(paymentGatewayHealth)
    expect(row?.unhealthySince).toBeNull()
    expect(row?.lastOkAt).not.toBeNull()

    // A new refusal after recovery is a new incident: the owner hears again.
    await pay(shop, await cartWith(shop), new RefusingGateway().refuseNext(), 'x@example.com')
    expect(await alerts()).toHaveLength(2)
    // Saving keys that pass ends it at once.
    await withStore(app, shop.storeId, (tx) => markGatewayHealthy(tx, shop.storeId, 'gw'))
    expect(await hidden(shop.storeId, [gw])).toEqual(new Set())
  })

  it('emails the owners about the incident, with the gateway words and never a key', async () => {
    const shop = await seedShop('off')
    await owner
      .update(store)
      .set({ contactEmail: 'owner@waimers.example' })
      .where(eq(store.id, shop.storeId))
    await pay(shop, await cartWith(shop), new RefusingGateway().refuseNext())
    const [row] = await alerts()
    const sent: MarketingSend[] = []
    const email: NotificationChannel = {
      id: 'ses',
      label: 'ses',
      requires: 'email',
      async send() {
        return { ok: true, providerRef: 'x' }
      },
      async sendMarketing(m) {
        sent.push(m)
        return { ok: true, providerRef: 'ses-1' }
      },
    }
    const deps = {
      settingsSecret: 's',
      adminUrl: 'https://admin.example',
      registry: {} as never,
      channels: [email],
    }
    const job = { storeId: shop.storeId, outboxId: row?.id as string }
    expect(await deliverGatewayAlertRow(app, job, deps)).toBe(true)
    expect(sent).toHaveLength(1)
    expect(sent[0]).toMatchObject({
      kind: 'email',
      to: { email: 'owner@waimers.example' },
      subject: 'Gw rejected your API keys: online payments are off',
    })
    const text = sent[0]?.kind === 'email' ? sent[0].text : ''
    expect(text).toContain('Authentication failed')
    expect(text).toContain('https://admin.example/settings/payments')
    const logged = await owner.select().from(notification)
    expect(logged).toMatchObject([{ template: 'gateway_keys_refused', status: 'sent' }])
  })
})
