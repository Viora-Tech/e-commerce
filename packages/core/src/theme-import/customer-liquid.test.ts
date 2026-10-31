/** SOURCE OF TRUTH: Liquid `customer` global tests — the signed-in shopper in Shopify's shape, nil signed out, and every read of it reported (`onCustomer`) so the storefront cache never shares a shopper's render. Real engine, fake data. No database */
import { describe, expect, it } from 'vitest'
import { fakeDataSource } from '../../test/theme-import-fixture'
import { buildThemeBundle } from './bundle'
import type { LiquidCustomerData } from './drops'
import { createPageContext, customerDrop } from './page-context'
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

async function contextFor(
  files: Record<string, string>,
  customer: LiquidCustomerData | null,
  onCustomer?: () => void,
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
    data: { ...fakeDataSource({}), customer: async () => customer },
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
  it('is the signed-in shopper in Shopify’s shape', () => {
    const drop = customerDrop(ASHA)
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
    expect(customerDrop(null)).toBeNull()
  })

  it('falls back to the email for a shopper without a name', () => {
    const drop = customerDrop({ ...ASHA, name: null, defaultAddress: null })
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
