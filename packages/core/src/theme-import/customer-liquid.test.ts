/** SOURCE OF TRUTH: Liquid `customer` global tests — the signed-in shopper in Shopify's shape, nil signed out, and every read of it reported (`onCustomer`) so the storefront cache never shares a shopper's render. Real engine, fake data. No database */
import { describe, expect, it } from 'vitest'
import { fakeDataSource } from '../../test/theme-import-fixture'
import { buildThemeBundle } from './bundle'
import { LiquidDataCache } from './cache'
import { customerDrop } from './customer-drops'
import type { LiquidCustomerData, LiquidOrderData } from './drops'
import { createPageContext } from './page-context'
import { renderLiquidSection } from './render'

const ASHA: LiquidCustomerData = {
  id: '0192f0a1-2b3c-7d4e-8f00-123456789abc',
  email: 'asha@example.test',
  name: 'Asha Rani Verma',
  phone: '+919800000001',
  acceptsMarketing: true,
  tags: ['vip'],
  ordersCount: 3,
  totalSpent: 459900,
  defaultAddress: {
    name: 'Asha Verma',
    line1: '12 MG Road',
    line2: null,
    city: 'Jaipur',
    stateCode: 'RJ',
    pincode: '302001',
    country: 'IN',
  },
  addressesCount: 2,
}

let themes = 0

const ORDERS: LiquidOrderData[] = [
  {
    id: '0192f0a1-2b3c-7d4e-8f00-000000002378',
    number: 2378,
    name: '#2378',
    createdAt: new Date('2026-10-30T10:00:00Z'),
    cancelled: false,
    cancelledAt: null,
    paymentStatus: 'paid',
    fulfillmentStatus: 'shipped',
    totalPrice: 129900,
    subtotalPrice: 119900,
    shippingPrice: 10000,
    lineItems: [
      {
        id: '0192f0a1-2b3c-7d4e-8f00-00000000a001',
        title: 'Claw Mouse',
        variantTitle: 'Black',
        quantity: 2,
        price: 59950,
        linePrice: 119900,
        image: { url: 'https://cdn.example/mouse.jpg', alt: 'Claw Mouse' },
        url: '/products/claw-mouse',
        fulfillment: {
          id: '0192f0a1-2b3c-7d4e-8f00-00000000f001',
          createdAt: new Date('2026-10-30T12:00:00Z'),
          trackingCompany: 'Delhivery',
          trackingNumber: 'AWB123',
          trackingUrl: 'https://track.example/AWB123',
          lines: [{ lineId: '0192f0a1-2b3c-7d4e-8f00-00000000a001', quantity: 2 }],
        },
      },
    ],
  },
  {
    id: '0192f0a1-2b3c-7d4e-8f00-000000002301',
    number: 2301,
    name: '#2301',
    createdAt: new Date('2026-10-01T10:00:00Z'),
    cancelled: true,
    cancelledAt: '2026-10-02T10:00:00Z',
    paymentStatus: 'refunded',
    fulfillmentStatus: 'unfulfilled',
    totalPrice: 50000,
    subtotalPrice: 50000,
    shippingPrice: 0,
    lineItems: [],
  },
]

async function contextFor(
  files: Record<string, string>,
  customer: LiquidCustomerData | null,
  onCustomer?: () => void,
  loads?: { orders: number },
) {
  const bundle = buildThemeBundle({
    themeId: `customer-${themes++}`,
    version: 'v1',
    textFiles: new Map(Object.entries(files)),
    assetChecksums: new Map(),
    settings: {},
  })
  const ctx = await createPageContext({
    bundle,
    data: {
      ...fakeDataSource({}),
      customer: async () => customer,
      customerOrders: async () => {
        if (loads) loads.orders++
        return ORDERS
      },
    },
    request: {
      template: 'page',
      path: '/pages/tracking',
      host: 'shop.example',
      origin: 'https://shop.example',
      designMode: false,
      postedForm: null,
      nonce: '',
    },
    assetBase: '/theme-assets/x',
    shopifyHost: null,
    moneyFormat: null,
    paymentTypes: [],
  })
  if (onCustomer) ctx.runtime.onCustomer = onCustomer
  return ctx
}

async function render(ctx: Awaited<ReturnType<typeof contextFor>>, type = 'probe') {
  const html = await renderLiquidSection(
    ctx,
    { id: type, type, settings: {}, blocks: [], location: 'template', index: 0 },
    (err) => {
      throw err
    },
  )
  return html.trim()
}

const GREETING =
  '{%- if customer -%}Hi {{ customer.first_name }} ({{ customer.email }}){%- else -%}Sign in to see your orders{%- endif -%}'

describe('the customer global', () => {
  const cache = new LiquidDataCache(fakeDataSource({}), [])

  it('is the signed-in shopper in Shopify’s shape', () => {
    const drop = customerDrop(ASHA, cache)
    expect(drop).toMatchObject({
      id: expect.any(Number),
      email: 'asha@example.test',
      first_name: 'Asha',
      last_name: 'Rani Verma',
      name: 'Asha Rani Verma',
      phone: '+919800000001',
      orders_count: 3,
      total_spent: 459900,
      tags: ['vip'],
      accepts_marketing: true,
      has_account: true,
      addresses_count: 2,
      default_address: {
        first_name: 'Asha',
        last_name: 'Verma',
        address1: '12 MG Road',
        address2: '',
        city: 'Jaipur',
        province_code: 'RJ',
        zip: '302001',
        country_code: 'IN',
      },
    })
    expect(customerDrop(null, cache)).toBeNull()
  })

  it('falls back to the email for a shopper without a name', () => {
    const drop = customerDrop({ ...ASHA, name: null, defaultAddress: null }, cache)
    expect(drop).toMatchObject({ first_name: '', last_name: '', name: 'asha@example.test' })
    expect(drop?.default_address).toBeNull()
  })

  it('renders for a signed-in shopper, and is nil signed out', async () => {
    const files = { 'sections/probe.liquid': GREETING }
    expect(await render(await contextFor(files, ASHA))).toBe('Hi Asha (asha@example.test)')
    expect(await render(await contextFor(files, null))).toBe('Sign in to see your orders')
  })

  it('prints spend with the money filter', async () => {
    const files = { 'sections/probe.liquid': '{{ customer.total_spent | money }}' }
    expect(await render(await contextFor(files, ASHA))).toContain('4,599')
  })

  it('reports every read of it, signed in or nil, and only those', async () => {
    const files = {
      'sections/probe.liquid': GREETING,
      'sections/plain.liquid': '<p>{{ shop.name }}</p>',
      'sections/nested.liquid': "{% render 'account-link' %}",
      'snippets/account-link.liquid':
        '{% unless customer %}<a href="/account/login">Log in</a>{% endunless %}',
    }
    for (const who of [ASHA, null]) {
      let reads = 0
      const ctx = await contextFor(files, who, () => {
        reads++
      })
      await render(ctx, 'plain')
      expect(reads).toBe(0)
      await render(ctx, 'probe')
      expect(reads).toBeGreaterThan(0)
      reads = 0
      await render(ctx, 'nested')
      expect(reads).toBeGreaterThan(0)
    }
  })
})

const TRACKING = `{%- if customer -%}{{ customer.orders.size }} orders
{%- assign live = customer.orders | where: 'cancelled', false -%}
{%- for order in live -%}
|{{ order.name }} {{ order.created_at | date: '%d %b %Y' }} {{ order.customer_url }} {{ order.fulfillment_status }} {{ order.fulfillment_status_label }} {{ order.financial_status_label }} {{ order.item_count }} {{ order.total_price | money }}
{%- for line_item in order.line_items -%}
 {{ line_item.title }} x{{ line_item.quantity }} ({{ line_item.variant_title }}) {{ line_item.fulfillment.tracking_company }} {{ line_item.fulfillment.tracking_number }} {{ line_item.fulfillment.tracking_url }} {{ line_item.fulfillment.fulfillment_line_items.first.line_item.title }}
{%- endfor -%}
{%- endfor -%}
{%- for order in customer.orders -%}{%- if order.cancelled -%}|cancelled {{ order.name }}{%- endif -%}{%- endfor -%}
{%- else -%}signed out{%- endif -%}`

describe('customer.orders', () => {
  it('lists the shopper’s orders, newest first, with tracking from line_item.fulfillment', async () => {
    const html = await render(await contextFor({ 'sections/probe.liquid': TRACKING }, ASHA))
    expect(html).toContain('2 orders')
    expect(html).toContain('|#2378 30 Oct 2026 /account/orders/2378 fulfilled Shipped Paid 2')
    expect(html).toContain('1,299')
    expect(html).toContain(
      'Claw Mouse x2 (Black) Delhivery AWB123 https://track.example/AWB123 Claw Mouse',
    )
    expect(html).toContain('|cancelled #2301')
    expect(html).not.toContain('|#2301')
  })

  it('loads the orders only when a render reads them, once per request', async () => {
    const loads = { orders: 0 }
    const files = {
      'sections/probe.liquid': TRACKING,
      'sections/greeting.liquid': 'Hi {{ customer.first_name }}',
    }
    const ctx = await contextFor(files, ASHA, undefined, loads)
    expect(await render(ctx, 'greeting')).toBe('Hi Asha')
    expect(loads.orders).toBe(0)
    await render(ctx, 'probe')
    await render(ctx, 'probe')
    expect(loads.orders).toBe(1)
  })

  it('never loads them signed out', async () => {
    const loads = { orders: 0 }
    const ctx = await contextFor({ 'sections/probe.liquid': TRACKING }, null, undefined, loads)
    expect(await render(ctx)).toBe('signed out')
    expect(loads.orders).toBe(0)
  })
})
