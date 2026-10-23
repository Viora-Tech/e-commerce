import {
  address,
  cart,
  cartLine,
  collection,
  collectionProduct,
  createDb,
  customer,
  inventoryLevel,
  order,
  orderLine,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createProduct } from '../../catalog/products'
import { CONDITION_FIELDS } from '../condition-fields'
import { evaluateRules, loadSubjectData, readPath } from './index'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

async function newStore() {
  const [s] = await owner.insert(store).values({ slug: 'loaders', name: 'Chai Co' }).returning()
  return s?.id as string
}

/** Every declared path of a subject resolves (a value, possibly null for a guest's customer). */
function expectAllPaths(subject: string, data: Record<string, unknown>) {
  for (const f of CONDITION_FIELDS.filter((x) => x.subject === subject)) {
    const { value } = readPath(data, f.path)
    expect(value, f.path).not.toBeUndefined()
  }
}

describe('subject loaders', () => {
  it('loads an order with its lines and customer, in paise and ISO dates', async () => {
    const storeId = await newStore()
    await withStore(app, storeId, async (tx) => {
      const productId = await createProduct(tx, storeId, {
        title: 'Masala tea',
        status: 'active',
        productType: 'Tea',
        tags: ['summer'],
        options: [],
        variants: [{ optionValues: [], pricePaise: 49_900, sku: 'TEA-1' }],
      })
      const [v] = await tx.select().from(variant).where(eq(variant.productId, productId))
      const [c] = await tx
        .insert(customer)
        .values({
          storeId,
          email: 'asha@example.com',
          name: 'Asha Rao',
          tags: ['vip'],
          acceptsMarketing: true,
          defaultAddress: {
            name: 'A',
            line1: 'x',
            city: 'Pune',
            stateCode: 'MH',
            pincode: '411001',
          },
        })
        .returning()
      const [a] = await tx
        .insert(address)
        .values({
          storeId,
          name: 'A',
          line1: 'x',
          city: 'Pune',
          stateCode: 'MH',
          pincode: '411001',
          phone: '9',
        })
        .returning()
      const [o] = await tx
        .insert(order)
        .values({
          storeId,
          number: 1042,
          customerId: c?.id,
          shippingAddressId: a?.id,
          paymentMethod: 'cod',
          subtotalPaise: 99_800,
          discountPaise: 5_000,
          discountCode: 'TEA5',
          totalPaise: 94_800,
          tags: ['Gift'],
        })
        .returning()
      await tx.insert(orderLine).values({
        storeId,
        orderId: o?.id as string,
        variantId: v?.id as string,
        title: 'Masala tea',
        quantity: 2,
        unitPricePaise: 49_900,
      })

      const data = await loadSubjectData(tx, storeId, { type: 'order', id: o?.id as string })
      expect(data).toMatchObject({
        order: {
          number: '1042',
          total: 94_800,
          subtotal: 99_800,
          discount_total: 5_000,
          discount_codes: ['TEA5'],
          is_cod: true,
          payment_method: 'cod',
          financial_status: 'pending',
          fulfillment_status: 'unfulfilled',
          shipping_state: 'Maharashtra',
          shipping_city: 'Pune',
          shipping_pincode: '411001',
          tags: ['Gift'],
          channel: 'online_store',
          item_count: 2,
          line_items: [
            {
              product_title: 'Masala tea',
              sku: 'TEA-1',
              quantity: 2,
              price: 49_900,
              product_tags: ['summer'],
              product_type: 'Tea',
            },
          ],
          customer: {
            first_name: 'Asha',
            tags: ['vip'],
            order_count: 1,
            total_spent: 94_800,
            has_ordered: true,
            email_consent: true,
            whatsapp_consent: false,
            accepts_marketing: true,
            state: 'Maharashtra',
          },
        },
        store: { name: 'Chai Co', timezone: 'Asia/Kolkata' },
      })
      expect(typeof (data?.order as { created_at: unknown }).created_at).toBe('string')
      expectAllPaths('order', data as Record<string, unknown>)

      const r = evaluateRules(
        {
          join: 'and',
          rules: [
            { field: 'order.total', op: 'gt', value: 90_000 },
            { field: 'order.line_items.product_tags', op: 'includes', value: 'Summer' },
            { field: 'order.customer.order_count', op: 'gte', value: 1 },
            { field: 'order.created_at', op: 'within_last_days', value: 1 },
          ],
        },
        data ?? {},
      )
      expect(r.pass).toBe(true)
    })
  })

  it('loads a product with live price, sellable stock and collections', async () => {
    const storeId = await newStore()
    await withStore(app, storeId, async (tx) => {
      const id = await createProduct(tx, storeId, {
        title: 'Mug',
        status: 'active',
        vendor: 'Kiln',
        options: [{ name: 'Size', values: [{ value: 'S' }, { value: 'L' }] }],
        variants: [
          { optionValues: ['S'], pricePaise: 29_900 },
          { optionValues: ['L'], pricePaise: 39_900 },
        ],
      })
      const variants = await tx.select().from(variant).where(eq(variant.productId, id))
      for (const v of variants) {
        await tx
          .insert(inventoryLevel)
          .values({ storeId, variantId: v.id, onHand: 5, reserved: 1, fulfilsOnline: true })
          .onConflictDoUpdate({
            target: [inventoryLevel.variantId, inventoryLevel.locationId],
            set: { onHand: 5, reserved: 1 },
          })
      }
      const [col] = await tx
        .insert(collection)
        .values({ storeId, handle: 'mugs', title: 'Mugs' })
        .returning()
      await tx
        .insert(collectionProduct)
        .values({ storeId, collectionId: col?.id as string, productId: id })
      const data = await loadSubjectData(tx, storeId, { type: 'product', id })
      expect(data?.product).toMatchObject({
        status: 'active',
        vendor: 'Kiln',
        price: 29_900,
        collections: ['Mugs'],
      })
      expect((data?.product as { total_stock: number }).total_stock).toBeGreaterThanOrEqual(8)
      expectAllPaths('product', data as Record<string, unknown>)
    })
  })

  it('loads a cart and a customer, and null for a missing record', async () => {
    const storeId = await newStore()
    await withStore(app, storeId, async (tx) => {
      const id = await createProduct(tx, storeId, {
        title: 'Tea',
        status: 'active',
        options: [],
        variants: [{ optionValues: [], pricePaise: 10_000 }],
      })
      const [v] = await tx.select().from(variant).where(eq(variant.productId, id))
      const [c] = await tx.insert(customer).values({ storeId, email: 'a@example.com' }).returning()
      const [k] = await tx.insert(cart).values({ storeId, customerId: c?.id }).returning()
      await tx
        .insert(cartLine)
        .values({
          storeId,
          cartId: k?.id as string,
          variantId: v?.id as string,
          quantity: 3,
          unitPricePaise: 10_000,
        })
      const cartData = await loadSubjectData(tx, storeId, { type: 'cart', id: k?.id as string })
      expect(cartData?.cart).toMatchObject({
        total: 30_000,
        item_count: 3,
        customer: { order_count: 0, has_ordered: false },
      })
      expectAllPaths('cart', cartData as Record<string, unknown>)
      const customerData = await loadSubjectData(tx, storeId, {
        type: 'customer',
        id: c?.id as string,
      })
      expectAllPaths('customer', customerData as Record<string, unknown>)
      expect(
        await loadSubjectData(tx, storeId, {
          type: 'order',
          id: '00000000-0000-4000-8000-000000000000',
        }),
      ).toBeNull()
      expect(await loadSubjectData(tx, storeId, { type: 'none', id: null })).toEqual({
        store: { name: 'Chai Co', timezone: 'Asia/Kolkata' },
      })
    })
  })
})
