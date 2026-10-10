/** SOURCE OF TRUTH: tests for extra fields on every owner type (CMS PR4) */
import {
  article,
  blog,
  createDb,
  customer,
  metafield,
  newId,
  order,
  page,
  product,
  type StoreTx,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { anonymiseCustomer } from '../privacy/anonymise'
import { METAFIELD_OWNER_PERMISSIONS } from './owner-permissions'
import { InvalidMetaobject, METAFIELD_OWNER_TYPES, type MetafieldOwnerType } from './schemas'
import {
  createMetafieldDefinition,
  deleteMetafieldsOf,
  getMetafields,
  listMetafieldDefinitions,
  setMetafields,
  updateMetafieldDefinition,
} from './service'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

const inStore = <T>(storeId: string, fn: (tx: StoreTx) => Promise<T>) => withStore(app, storeId, fn)

/** One record of every kind an extra field can sit on. */
async function seed(slug = 'w') {
  const [s] = await owner.insert(store).values({ slug, name: slug }).returning()
  const storeId = s?.id as string
  const productId = newId()
  await owner.insert(product).values({ id: productId, storeId, title: 'Pad', handle: 'pad' })
  const variantId = newId()
  await owner
    .insert(variant)
    .values({ id: variantId, storeId, productId, title: 'Black', pricePaise: 1000 })
  const [cu] = await owner
    .insert(customer)
    .values({ storeId, email: `asha@${slug}.example`, name: 'Asha' })
    .returning()
  const [o] = await owner
    .insert(order)
    .values({ storeId, number: 1, status: 'open', subtotalPaise: 1000, totalPaise: 1000 })
    .returning()
  const [pg] = await owner
    .insert(page)
    .values({ storeId, title: 'About', handle: 'about', data: { content: [], root: {} } })
    .returning()
  const [b] = await owner
    .insert(blog)
    .values({ storeId, title: 'News', handle: 'news' })
    .returning()
  const [a] = await owner
    .insert(article)
    .values({ storeId, blogId: b?.id as string, title: 'Hello', handle: 'hello' })
    .returning()
  const ids: Record<Exclude<MetafieldOwnerType, 'collection'>, string> = {
    product: productId,
    variant: variantId,
    customer: cu?.id as string,
    order: o?.id as string,
    page: pg?.id as string,
    article: a?.id as string,
    shop: storeId,
  }
  return { storeId, ids }
}

const note = (ownerType: MetafieldOwnerType, storefrontAccess = true) => ({
  ownerType,
  name: 'Note',
  namespace: 'custom',
  type: 'single_line_text' as const,
  list: false,
  validations: {},
  storefrontAccess,
})

describe('extra fields on every owner type', () => {
  it('defines, fills in and reads back a field on variants, customers, orders, pages, posts and the shop', async () => {
    const { storeId, ids } = await seed()
    for (const [ownerType, ownerId] of Object.entries(ids) as [MetafieldOwnerType, string][]) {
      const def = await inStore(storeId, (tx) =>
        createMetafieldDefinition(tx, storeId, note(ownerType)),
      )
      await inStore(storeId, (tx) =>
        setMetafields(tx, storeId, {
          ownerType,
          ownerId,
          values: { [def.id]: `for ${ownerType}` },
        }),
      )
      const got = await inStore(storeId, (tx) => getMetafields(tx, ownerType, ownerId))
      expect(got.definitions.map((d) => d.id)).toEqual([def.id])
      expect(got.values).toEqual({ [def.id]: `for ${ownerType}` })
    }
    // The same key on different owners is a different field.
    const lists = await inStore(storeId, (tx) =>
      Promise.all(METAFIELD_OWNER_TYPES.map((t) => listMetafieldDefinitions(tx, t))),
    )
    expect(lists.map((l) => l.length)).toEqual([1, 1, 0, 1, 1, 1, 1, 1])
  })

  it('keeps customer and order fields off the storefront whatever the form says', async () => {
    const { storeId } = await seed()
    for (const ownerType of ['customer', 'order'] as const) {
      const def = await inStore(storeId, (tx) =>
        createMetafieldDefinition(tx, storeId, note(ownerType, true)),
      )
      await inStore(storeId, (tx) => updateMetafieldDefinition(tx, def.id, note(ownerType, true)))
      const [row] = await inStore(storeId, (tx) => listMetafieldDefinitions(tx, ownerType))
      expect(row?.storefrontAccess).toBe(false)
    }
    const page = await inStore(storeId, (tx) =>
      createMetafieldDefinition(tx, storeId, note('page', true)),
    )
    const [pageRow] = await inStore(storeId, (tx) => listMetafieldDefinitions(tx, 'page'))
    expect(pageRow?.id).toBe(page.id)
    expect(pageRow?.storefrontAccess).toBe(true)
  })

  it('refuses a missing owner, in plain words', async () => {
    const { storeId } = await seed()
    for (const [ownerType, word] of [
      ['variant', 'variant'],
      ['customer', 'customer'],
      ['order', 'order'],
      ['page', 'page'],
      ['article', 'blog post'],
    ] as const) {
      await expect(
        inStore(storeId, (tx) =>
          setMetafields(tx, storeId, { ownerType, ownerId: newId(), values: {} }),
        ),
      ).rejects.toThrow(new InvalidMetaobject([`This ${word} no longer exists`]).message)
    }
  })

  it('never lets one store fill in another store’s records or its shop fields', async () => {
    const a = await seed('a')
    const b = await seed('b')
    for (const ownerType of ['customer', 'order', 'shop'] as const) {
      const def = await inStore(a.storeId, (tx) =>
        createMetafieldDefinition(tx, a.storeId, note(ownerType)),
      )
      await expect(
        inStore(a.storeId, (tx) =>
          setMetafields(tx, a.storeId, {
            ownerType,
            ownerId: b.ids[ownerType],
            values: { [def.id]: 'x' },
          }),
        ),
      ).rejects.toBeInstanceOf(InvalidMetaobject)
    }
    expect(await owner.select().from(metafield)).toHaveLength(0)
  })

  it('drops a customer’s extra fields when they are erased', async () => {
    const { storeId, ids } = await seed()
    const def = await inStore(storeId, (tx) =>
      createMetafieldDefinition(tx, storeId, note('customer')),
    )
    const orderDef = await inStore(storeId, (tx) =>
      createMetafieldDefinition(tx, storeId, note('order')),
    )
    await inStore(storeId, (tx) =>
      setMetafields(tx, storeId, {
        ownerType: 'customer',
        ownerId: ids.customer,
        values: { [def.id]: 'Prefers WhatsApp' },
      }),
    )
    await inStore(storeId, (tx) =>
      setMetafields(tx, storeId, {
        ownerType: 'order',
        ownerId: ids.order,
        values: { [orderDef.id]: 'Gift wrap' },
      }),
    )
    await inStore(storeId, (tx) =>
      anonymiseCustomer(
        { storeId, tx },
        { customerId: ids.customer, actor: { type: 'staff', label: 'owner@w.example' } },
      ),
    )
    const left = await owner.select().from(metafield)
    expect(left.map((m) => m.ownerType)).toEqual(['order'])
  })

  it('deleteMetafieldsOf removes only the named owners’ values', async () => {
    const { storeId, ids } = await seed()
    const def = await inStore(storeId, (tx) =>
      createMetafieldDefinition(tx, storeId, note('customer')),
    )
    const other = newId()
    await owner.insert(customer).values({ id: other, storeId, email: 'ravi@w.example' })
    for (const ownerId of [ids.customer, other]) {
      await inStore(storeId, (tx) =>
        setMetafields(tx, storeId, { ownerType: 'customer', ownerId, values: { [def.id]: 'x' } }),
      )
    }
    expect(await inStore(storeId, (tx) => deleteMetafieldsOf(tx, 'customer', [ids.customer]))).toBe(
      1,
    )
    expect(await inStore(storeId, (tx) => deleteMetafieldsOf(tx, 'customer', []))).toBe(0)
    const left = await owner.select().from(metafield).where(eq(metafield.ownerType, 'customer'))
    expect(left.map((m) => m.ownerId)).toEqual([other])
  })
})

describe('METAFIELD_OWNER_PERMISSIONS', () => {
  it('guards each owner with the access of the record it sits on', () => {
    expect(Object.keys(METAFIELD_OWNER_PERMISSIONS).sort()).toEqual(
      [...METAFIELD_OWNER_TYPES].sort(),
    )
    expect(METAFIELD_OWNER_PERMISSIONS.customer).toEqual({
      read: 'customers.read',
      write: 'customers.write',
    })
    expect(METAFIELD_OWNER_PERMISSIONS.order.write).toBe('orders.write')
    expect(METAFIELD_OWNER_PERMISSIONS.shop.write).toBe('settings.manage')
    expect(METAFIELD_OWNER_PERMISSIONS.variant.write).toBe('products.write')
  })
})
