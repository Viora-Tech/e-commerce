import { createDb, customer, newId, order, orderLine, product, store, variant } from '@commerce/db'

export const owner = createDb(process.env.DATABASE_URL_OWNER as string)
export const app = createDb(process.env.DATABASE_URL as string)

export async function seedStore(): Promise<string> {
  const slug = `s-${Math.random().toString(36).slice(2)}`
  const [s] = await owner.insert(store).values({ slug, name: slug }).returning()
  if (!s) throw new Error('seed')
  return s.id
}

export async function addProduct(
  storeId: string,
  handle: string,
  opts: { sku?: string; status?: 'active' | 'draft' } = {},
) {
  const id = newId()
  await owner
    .insert(product)
    .values({ id, storeId, title: handle, handle, status: opts.status ?? 'active' })
  const variantId = newId()
  await owner.insert(variant).values({
    id: variantId,
    storeId,
    productId: id,
    title: 'Default',
    pricePaise: 100000,
    sku: opts.sku ?? null,
  })
  return { productId: id, variantId }
}

export async function addCustomer(storeId: string, email: string, name = 'Aarav Mehta') {
  const id = newId()
  await owner.insert(customer).values({ id, storeId, email, name })
  return id
}

let orderNumber = 1000

/** An order holding one line of each variant, for this email (and customer when given). */
export async function addOrder(
  storeId: string,
  input: {
    email: string
    customerId?: string | null
    variantIds: string[]
    status?: 'open' | 'completed' | 'cancelled'
  },
) {
  const id = newId()
  orderNumber += 1
  await owner.insert(order).values({
    id,
    storeId,
    number: orderNumber,
    email: input.email,
    customerId: input.customerId ?? null,
    status: input.status ?? 'open',
    fulfillmentStatus: 'delivered',
    subtotalPaise: 100000,
    totalPaise: 100000,
  })
  for (const variantId of input.variantIds) {
    await owner.insert(orderLine).values({
      storeId,
      orderId: id,
      variantId,
      title: 'Line',
      quantity: 1,
      unitPricePaise: 100000,
    })
  }
  return { orderId: id, number: orderNumber }
}
