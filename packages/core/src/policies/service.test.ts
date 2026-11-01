/** SOURCE OF TRUTH: policy and checkout settings service tests (database) — policy pages upsert and publish, template facts from returns and rates, merged preference saves, and placeOrder enforcing Settings → Checkout */
import {
  createDb,
  inventoryLevel,
  order,
  page,
  product,
  shippingRate,
  shippingZone,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { addToCart, createCart } from '../cart/cart'
import { loadCheckoutSettings, saveCheckoutSettings, storeCheckoutLook } from '../checkout/service'
import type { StoreContext } from '../context'
import { CheckoutRuleViolation } from '../errors'
import { placeOrderAndPay } from '../order/place-order'
import { CodPaymentProvider } from '../providers/cod'
import {
  listPolicies,
  loadPolicySettings,
  policyFromTemplate,
  publishedPolicyLinks,
  savePolicy,
  savePolicySettings,
} from './service'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

beforeEach(async () => {
  await resetDb(owner)
})

const GSTIN = '27AAPFU0939F1ZV'

async function seed() {
  const [s] = await owner
    .insert(store)
    .values({
      slug: 'w',
      name: 'Waimers',
      contactEmail: 'care@waimers.in',
      contactPhone: '+91 98765 43210',
      address: { line1: 'Plot 4', city: 'Gurugram', state: 'HR', pincode: '122015' },
      returns: { windowDays: 10 },
      preferences: { seo: { title: 'Kept' } },
      payments: { enabled: ['cod'], providers: { razorpay: { keyId: 'kept' } } },
    })
    .returning()
  if (!s) throw new Error('seed')
  const [p] = await owner
    .insert(product)
    .values({ storeId: s.id, handle: 'pad', title: 'Glasspad', status: 'active' })
    .returning()
  if (!p) throw new Error('seed')
  const [v] = await owner
    .insert(variant)
    .values({ storeId: s.id, productId: p.id, title: 'Black', pricePaise: 100_000 })
    .returning()
  if (!v) throw new Error('seed')
  await owner.insert(inventoryLevel).values({ storeId: s.id, variantId: v.id, onHand: 50 })
  return { storeId: s.id, variantId: v.id }
}

const inStore = <T>(storeId: string, fn: (ctx: StoreContext) => Promise<T>) =>
  withStore(app, storeId, (tx) => fn({ storeId, tx }))

describe('policy pages', () => {
  it('creates, publishes and lists policies as pages with their fixed handles', async () => {
    const { storeId } = await seed()
    const body = { root: { type: 'root', children: [] } }
    await inStore(storeId, async (ctx) => {
      const before = await listPolicies(ctx)
      expect(before.map((p) => [p.type, p.pageId])).toEqual([
        ['refund-policy', null],
        ['privacy-policy', null],
        ['terms-of-service', null],
        ['shipping-policy', null],
        ['contact-information', null],
      ])
      const saved = await savePolicy(ctx, {
        type: 'refund-policy',
        title: '',
        body,
        published: true,
      })
      expect(saved.title).toBe('Refund and returns policy')
      expect(saved.published).toBe(true)
      await savePolicy(ctx, { type: 'privacy-policy', title: 'Privacy', body, published: false })
      expect(await publishedPolicyLinks(ctx)).toEqual([
        {
          type: 'refund-policy',
          title: 'Refund and returns policy',
          href: '/policies/refund-policy',
        },
      ])
    })
    const rows = await owner.select().from(page).where(eq(page.storeId, storeId))
    expect(rows.map((r) => r.handle).sort()).toEqual(['privacy-policy', 'refund-policy'])
  })

  it('refuses to show a policy that still has a template gap, but saves it hidden', async () => {
    const { storeId } = await seed()
    const text = { type: 'text', text: 'Write to us at [email address].' }
    const body = { root: { type: 'root', children: [{ type: 'paragraph', children: [text] }] } }
    await inStore(storeId, async (ctx) => {
      await expect(
        savePolicy(ctx, { type: 'refund-policy', title: '', body, published: true }),
      ).rejects.toThrow('Fill in [email address]')
      const hidden = await savePolicy(ctx, {
        type: 'refund-policy',
        title: '',
        body,
        published: false,
      })
      expect(hidden.published).toBe(false)
    })
  })

  it('keeps the first publish date when a policy is saved again', async () => {
    const { storeId } = await seed()
    const body = { root: { type: 'root', children: [] } }
    await inStore(storeId, (ctx) =>
      savePolicy(ctx, { type: 'terms-of-service', title: 'Terms', body, published: true }),
    )
    const [first] = await owner.select().from(page).where(eq(page.handle, 'terms-of-service'))
    await inStore(storeId, (ctx) =>
      savePolicy(ctx, { type: 'terms-of-service', title: 'Terms v2', body, published: true }),
    )
    const [second] = await owner.select().from(page).where(eq(page.handle, 'terms-of-service'))
    expect(second?.title).toBe('Terms v2')
    expect(second?.publishedAt?.getTime()).toBe(first?.publishedAt?.getTime())
  })

  it('fills templates from returns, rates and the grievance officer, keeping other preferences', async () => {
    const { storeId } = await seed()
    const [zone] = await owner
      .insert(shippingZone)
      .values({ storeId, name: 'India', stateCodes: [] })
      .returning()
    await owner.insert(shippingRate).values({
      storeId,
      zoneId: zone?.id as string,
      name: 'Standard',
      pricePaise: 4900,
      minTransitDays: 2,
      maxTransitDays: 5,
      freeAbovePaise: 99_900,
    })
    await inStore(storeId, (ctx) =>
      savePolicySettings(ctx, {
        legalName: 'Waimers Tech Private Limited',
        grievanceOfficer: {
          name: 'Asha',
          designation: 'Founder',
          email: 'g@waimers.in',
          phone: '',
        },
      }),
    )
    const [s] = await owner.select().from(store).where(eq(store.id, storeId))
    expect(s?.preferences).toMatchObject({ seo: { title: 'Kept' } })
    const draft = await inStore(storeId, (ctx) => policyFromTemplate(ctx, 'refund-policy'))
    const text = JSON.stringify(draft.body)
    expect(text).toContain('Waimers Tech Private Limited')
    expect(text).toContain('within 10 days of delivery')
    expect(text).toContain('Name: Asha')
    expect(draft.missing).toEqual([])
    const shipping = JSON.stringify(
      (await inStore(storeId, (ctx) => policyFromTemplate(ctx, 'shipping-policy'))).body,
    )
    expect(shipping).toContain('2 to 5 days')
    expect((await inStore(storeId, (ctx) => loadPolicySettings(ctx))).legalName).toBe(
      'Waimers Tech Private Limited',
    )
  })
})

describe('checkout settings', () => {
  it('saves checkout rules and the COD fee without touching other settings', async () => {
    const { storeId } = await seed()
    const view = await inStore(storeId, (ctx) =>
      saveCheckoutSettings(ctx, {
        settings: { minimumOrderPaise: 50_000, cod: { blockedPincodes: ['560001'] } },
        codFee: { type: 'fixed', value: 4900, label: 'COD fee' },
      }),
    )
    expect(view.codEnabled).toBe(true)
    expect(view.codFee).toEqual({ type: 'fixed', value: 4900, label: 'COD fee' })
    expect(view.settings.cod.blockedPincodes).toEqual(['560001'])
    const [s] = await owner.select().from(store).where(eq(store.id, storeId))
    expect(s?.preferences).toMatchObject({ seo: { title: 'Kept' } })
    expect(s?.payments).toMatchObject({ providers: { razorpay: { keyId: 'kept' } } })
    const cleared = await inStore(storeId, (ctx) =>
      saveCheckoutSettings(ctx, { settings: view.settings, codFee: null }),
    )
    expect(cleared.codFee).toBeNull()
    expect(
      (await inStore(storeId, (ctx) => loadCheckoutSettings(ctx))).settings.minimumOrderPaise,
    ).toBe(50_000)
  })
})

describe('checkout colours', () => {
  // The default theme's light scheme paints buttons Waimers purple.
  const THEME_BRAND = '#6C3BAA'

  it('follows the theme brand colour until the store picks its own', async () => {
    const { storeId } = await seed()
    const loaded = await inStore(storeId, (ctx) => loadCheckoutSettings(ctx))
    expect(loaded.settings.branding).toMatchObject({ accent: THEME_BRAND, button: THEME_BRAND })
    const look = await inStore(storeId, (ctx) => storeCheckoutLook(ctx))
    expect(look.branding).toMatchObject({ accent: THEME_BRAND, button: THEME_BRAND })
  })

  it('treats a stored stock blue as not picked, and keeps a picked colour', async () => {
    const { storeId } = await seed()
    // A save from before the fallback stored the whole branding, stock blue included.
    const stock = await inStore(storeId, (ctx) => saveCheckoutSettings(ctx, { settings: {} }))
    expect(stock.settings.branding.accent).toBe(THEME_BRAND)
    const picked = await inStore(storeId, (ctx) =>
      saveCheckoutSettings(ctx, { settings: { branding: { accent: '#112233' } } }),
    )
    expect(picked.settings.branding).toMatchObject({ accent: '#112233', button: THEME_BRAND })
    const look = await inStore(storeId, (ctx) => storeCheckoutLook(ctx))
    expect(look.branding).toMatchObject({ accent: '#112233', button: THEME_BRAND })
  })
})

describe('placeOrder enforces Settings → Checkout', () => {
  const checkout = {
    email: 'buyer@example.com',
    phone: '+91 98765 43210',
    name: 'A Buyer',
    address: { line1: '1 Street', city: 'Sonipat', stateCode: 'HR', pincode: '131001' },
  }

  async function cartOf(storeId: string, variantId: string, quantity: number) {
    return inStore(storeId, async (ctx) => {
      const id = await createCart(ctx)
      await addToCart(ctx, id, variantId, quantity)
      return id
    })
  }

  it('stores the GSTIN, business name and note, and a normalised phone', async () => {
    const { storeId, variantId } = await seed()
    await inStore(storeId, (ctx) =>
      saveCheckoutSettings(ctx, { settings: { gstin: true, orderNotes: true } }),
    )
    const cartId = await cartOf(storeId, variantId, 1)
    const r = await placeOrderAndPay(app, storeId, {
      cartId,
      paymentProvider: new CodPaymentProvider(),
      checkout: {
        ...checkout,
        gstin: GSTIN.toLowerCase(),
        businessName: 'Asha Traders',
        note: 'Call first',
      },
    })
    const [o] = await owner.select().from(order).where(eq(order.id, r.orderId))
    expect(o?.buyerGstin).toBe(GSTIN)
    expect(o?.buyerBusinessName).toBe('Asha Traders')
    expect(o?.customerNote).toBe('Call first')
    expect(o?.phone).toBe('9876543210')
  })

  it('refuses a GSTIN typo, a small order and COD above the limit', async () => {
    const { storeId, variantId } = await seed()
    await inStore(storeId, (ctx) =>
      saveCheckoutSettings(ctx, {
        settings: { gstin: true, minimumOrderPaise: 150_000, cod: { maxOrderPaise: 250_000 } },
      }),
    )
    const place = async (quantity: number, extra: Record<string, string> = {}) =>
      placeOrderAndPay(app, storeId, {
        cartId: await cartOf(storeId, variantId, quantity),
        paymentProvider: new CodPaymentProvider(),
        checkout: { ...checkout, ...extra },
      })
    await expect(place(2, { gstin: '27AAPFU0939F1ZW' })).rejects.toMatchObject({ rule: 'contact' })
    await expect(place(1)).rejects.toMatchObject({ rule: 'minimum_order', amountPaise: 50_000 })
    await expect(place(3)).rejects.toBeInstanceOf(CheckoutRuleViolation)
    await expect(place(2)).resolves.toMatchObject({ paymentStatus: 'pending' })
  })

  it('takes an order without email when email is optional', async () => {
    const { storeId, variantId } = await seed()
    await inStore(storeId, (ctx) => saveCheckoutSettings(ctx, { settings: { email: 'optional' } }))
    const r = await placeOrderAndPay(app, storeId, {
      cartId: await cartOf(storeId, variantId, 1),
      paymentProvider: new CodPaymentProvider(),
      checkout: { ...checkout, email: '' },
    })
    const [o] = await owner.select().from(order).where(eq(order.id, r.orderId))
    expect(o?.email).toBeNull()
    expect(o?.customerId).not.toBeNull()
  })
})
