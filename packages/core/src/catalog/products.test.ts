import {
  collection,
  collectionProduct,
  createDb,
  inventoryAdjustment,
  inventoryLevel,
  order,
  orderLine,
  product,
  productOption,
  productOptionValue,
  store,
  variant,
  variantOptionValue,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { asc, eq, sql } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import {
  adjustInventory,
  createProduct,
  deleteProduct,
  InvalidProduct,
  slugify,
  uniqueHandle,
  updateProduct,
} from './products'
import { type ProductWrite, ProductWriteSchema } from './schemas'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

async function seedStore() {
  const [s] = await owner.insert(store).values({ slug: 'w', name: 'W' }).returning()
  if (!s) throw new Error('seed')
  return s.id
}

const write: ProductWrite = {
  title: 'Shion Glasspad',
  status: 'active',
  tags: ['Glasspad', 'glasspad', ' new '],
  options: [
    { name: 'Colour', values: [{ value: 'Purple' }, { value: 'Black' }] },
    { name: 'Size', values: [{ value: 'L' }] },
  ],
  variants: [
    { optionValues: ['Purple', 'L'], pricePaise: 499900, sku: 'SG-P-L', onHand: 5 },
    { optionValues: ['Black', 'L'], pricePaise: 499900, sku: 'SG-B-L' },
  ],
}

async function load(storeId: string, id: string) {
  return withStore(app, storeId, async (tx) => {
    const [p] = await tx.select().from(product).where(eq(product.id, id))
    const vs = await tx
      .select()
      .from(variant)
      .where(eq(variant.productId, id))
      .orderBy(asc(variant.position))
    const opts = await tx
      .select()
      .from(productOption)
      .where(eq(productOption.productId, id))
      .orderBy(asc(productOption.position))
    const vals = await tx.select().from(productOptionValue)
    const links = await tx.select().from(variantOptionValue)
    const levels = await tx.select().from(inventoryLevel)
    return { p, vs, opts, vals, links, levels }
  })
}

describe('slugify / uniqueHandle', () => {
  it('produces ascii handles and suffixes collisions', async () => {
    expect(slugify('TALONGAMES 幻 Maboroshi — Série')).toBe('talongames-maboroshi-serie')
    const storeId = await seedStore()
    await withStore(app, storeId, async (tx) => {
      expect(await uniqueHandle(tx, 'Shion Pad')).toBe('shion-pad')
      await tx.insert(product).values({ storeId, handle: 'shion-pad', title: 'x' })
      await tx.insert(product).values({ storeId, handle: 'shion-pad-2', title: 'x' })
      expect(await uniqueHandle(tx, 'Shion Pad')).toBe('shion-pad-3')
    })
  })
})

describe('createProduct', () => {
  it('writes options, the variant matrix, inventory and adjustments', async () => {
    const storeId = await seedStore()
    const id = await withStore(app, storeId, (tx) => createProduct(tx, storeId, write))
    const { p, vs, opts, vals, links, levels } = await load(storeId, id)
    expect(p?.handle).toBe('shion-glasspad')
    expect(p?.tags).toEqual(['Glasspad', 'new'])
    expect(opts.map((o) => o.name)).toEqual(['Colour', 'Size'])
    expect(vals).toHaveLength(3)
    expect(vs.map((v) => v.title)).toEqual(['Purple / L', 'Black / L'])
    expect(links).toHaveLength(4)
    expect(levels.find((l) => l.variantId === vs[0]?.id)?.onHand).toBe(5)
    expect(levels.find((l) => l.variantId === vs[1]?.id)?.onHand).toBe(0)
    const adj = await withStore(app, storeId, (tx) => tx.select().from(inventoryAdjustment))
    expect(adj).toEqual([expect.objectContaining({ delta: 5, reason: 'received' })])
  })

  it('saves a variant with no price yet, draft or active (#913)', async () => {
    const storeId = await seedStore()
    const id = await withStore(app, storeId, (tx) =>
      createProduct(tx, storeId, {
        title: 'Unpriced pad',
        status: 'active',
        options: [],
        variants: [{ optionValues: [], pricePaise: null }],
      }),
    )
    const { p, vs } = await load(storeId, id)
    expect(p?.status).toBe('active')
    expect(vs.map((v) => v.pricePaise)).toEqual([null])
  })

  it('rejects an inconsistent matrix', async () => {
    const storeId = await seedStore()
    await expect(
      withStore(app, storeId, (tx) =>
        createProduct(tx, storeId, {
          ...write,
          variants: [{ optionValues: ['Purple'], pricePaise: 1 }],
        }),
      ),
    ).rejects.toBeInstanceOf(InvalidProduct)
  })
})

describe('updateProduct', () => {
  it('keeps matching variant ids, creates new ones, deletes unreferenced ones', async () => {
    const storeId = await seedStore()
    const id = await withStore(app, storeId, (tx) => createProduct(tx, storeId, write))
    const before = await load(storeId, id)
    const purple = before.vs[0]
    if (!purple) throw new Error('seed')

    await withStore(app, storeId, (tx) =>
      updateProduct(tx, storeId, id, {
        ...write,
        title: 'Shion Glasspad v2',
        handle: 'shion-v2',
        options: [
          { name: 'Colour', values: [{ value: 'Purple' }, { value: 'Red' }] },
          { name: 'Size', values: [{ value: 'L' }] },
        ],
        variants: [
          { id: purple.id, optionValues: ['Purple', 'L'], pricePaise: 459900, onHand: 2 },
          { optionValues: ['Red', 'L'], pricePaise: 499900 },
        ],
      }),
    )
    const after = await load(storeId, id)
    expect(after.p?.handle).toBe('shion-v2')
    expect(after.vs.map((v) => v.title)).toEqual(['Purple / L', 'Red / L'])
    expect(after.vs[0]?.id).toBe(purple.id)
    expect(after.vs[0]?.pricePaise).toBe(459900)
    expect(after.levels.find((l) => l.variantId === purple.id)?.onHand).toBe(2)
    // Black was never ordered: gone, and its option value pruned.
    expect(after.vals.map((v) => v.value).sort()).toEqual(['L', 'Purple', 'Red'])
    expect(after.links).toHaveLength(4)
  })

  it('archives a removed variant that an order references and revives it when it returns', async () => {
    const storeId = await seedStore()
    const id = await withStore(app, storeId, (tx) => createProduct(tx, storeId, write))
    const { vs } = await load(storeId, id)
    const black = vs[1]
    if (!black) throw new Error('seed')
    const [o] = await owner
      .insert(order)
      .values({ storeId, number: 1, subtotalPaise: 1, totalPaise: 1 })
      .returning()
    if (!o) throw new Error('seed')
    await owner.insert(orderLine).values({
      storeId,
      orderId: o.id,
      variantId: black.id,
      quantity: 1,
      unitPricePaise: 1,
    })

    const onlyPurple: ProductWrite = {
      ...write,
      options: [
        { name: 'Colour', values: [{ value: 'Purple' }] },
        { name: 'Size', values: [{ value: 'L' }] },
      ],
      variants: [{ optionValues: ['Purple', 'L'], pricePaise: 1 }],
    }
    await withStore(app, storeId, (tx) => updateProduct(tx, storeId, id, onlyPurple))
    const archived = await load(storeId, id)
    const row = archived.vs.find((v) => v.id === black.id)
    expect(row?.archivedAt).not.toBeNull()
    expect(row?.title).toBe('Black / L')
    expect(archived.vals.map((v) => v.value).sort()).toEqual(['L', 'Purple'])

    await withStore(app, storeId, (tx) => updateProduct(tx, storeId, id, write))
    const revived = await load(storeId, id)
    expect(revived.vs.find((v) => v.id === black.id)?.archivedAt).toBeNull()
    expect(revived.vs).toHaveLength(2)
  })
})

describe("a variant's own pre-order limit on save", () => {
  it('writes the limit, keeps the other override keys, and clears it when blank', async () => {
    const storeId = await seedStore()
    const id = await withStore(app, storeId, (tx) => createProduct(tx, storeId, write))
    const { vs } = await load(storeId, id)
    const purple = vs[0]
    if (!purple) throw new Error('seed')
    // A key the admin does not edit, written by another tool, must survive the save.
    await owner
      .update(variant)
      .set({ preorderOverride: { enabled: false, buttonLabel: 'Reserve' } })
      .where(eq(variant.id, purple.id))
    const withLimit = (limit: number | null | undefined): ProductWrite => ({
      ...write,
      variants: write.variants.map((v, i) =>
        i === 0 ? { ...v, id: purple.id, preorderLimit: limit } : v,
      ),
    })

    await withStore(app, storeId, (tx) => updateProduct(tx, storeId, id, withLimit(4)))
    let row = (await load(storeId, id)).vs.find((v) => v.id === purple.id)
    expect(row?.preorderOverride).toEqual({ enabled: false, buttonLabel: 'Reserve', limit: 4 })

    // Left out (an older client, an import): the stored limit stays.
    await withStore(app, storeId, (tx) => updateProduct(tx, storeId, id, withLimit(undefined)))
    row = (await load(storeId, id)).vs.find((v) => v.id === purple.id)
    expect(row?.preorderOverride).toEqual({ enabled: false, buttonLabel: 'Reserve', limit: 4 })

    await withStore(app, storeId, (tx) => updateProduct(tx, storeId, id, withLimit(null)))
    row = (await load(storeId, id)).vs.find((v) => v.id === purple.id)
    expect(row?.preorderOverride).toEqual({ enabled: false, buttonLabel: 'Reserve' })
  })

  it('rejects a limit below 1', () => {
    const bad = {
      ...write,
      variants: [{ optionValues: ['Purple', 'L'], pricePaise: 1, preorderLimit: 0 }],
    }
    expect(ProductWriteSchema.safeParse(bad).success).toBe(false)
  })
})

describe('inventory + delete', () => {
  it('adjustInventory refuses to go negative and logs deltas', async () => {
    const storeId = await seedStore()
    const id = await withStore(app, storeId, (tx) => createProduct(tx, storeId, write))
    const { vs } = await load(storeId, id)
    const v = vs[0]
    if (!v) throw new Error('seed')
    await withStore(app, storeId, (tx) =>
      adjustInventory(tx, storeId, v.id, -3, 'damaged', 'water'),
    )
    await expect(
      withStore(app, storeId, (tx) => adjustInventory(tx, storeId, v.id, -10, 'sold')),
    ).rejects.toMatchObject({ code: 'NEGATIVE_STOCK' })
    const { levels } = await load(storeId, id)
    expect(levels.find((l) => l.variantId === v.id)?.onHand).toBe(2)
  })

  it("keeps an import's oversold (negative) stock; a merchant's own save still stops at zero", async () => {
    const storeId = await seedStore()
    const oversold = { ...write, variants: write.variants.map((v) => ({ ...v, onHand: -7 })) }
    const id = await withStore(app, storeId, (tx) =>
      createProduct(tx, storeId, oversold, { imported: true }),
    )
    const { levels } = await load(storeId, id)
    expect(levels.map((l) => l.onHand)).toEqual(levels.map(() => -7))
    await withStore(app, storeId, (tx) =>
      updateProduct(tx, storeId, id, oversold, { imported: true }),
    )
    await expect(
      withStore(app, storeId, (tx) => createProduct(tx, storeId, oversold)),
    ).rejects.toMatchObject({ code: 'NEGATIVE_STOCK' })
  })

  it('deletes an unordered product and archives an ordered one', async () => {
    const storeId = await seedStore()
    const a = await withStore(app, storeId, (tx) => createProduct(tx, storeId, write))
    const b = await withStore(app, storeId, (tx) =>
      createProduct(tx, storeId, { ...write, title: 'Other' }),
    )
    const { vs } = await load(storeId, b)
    const [o] = await owner
      .insert(order)
      .values({ storeId, number: 1, subtotalPaise: 1, totalPaise: 1 })
      .returning()
    if (!o || !vs[0]) throw new Error('seed')
    await owner.insert(orderLine).values({
      storeId,
      orderId: o.id,
      variantId: vs[0].id,
      quantity: 1,
      unitPricePaise: 1,
    })
    expect(await withStore(app, storeId, (tx) => deleteProduct(tx, a))).toBe('deleted')
    expect(await withStore(app, storeId, (tx) => deleteProduct(tx, b))).toBe('archived')
    const rows = await withStore(app, storeId, (tx) => tx.select().from(product))
    expect(rows.map((r) => [r.id, r.status])).toEqual([[b, 'archived']])
  })

  it('deletes a product that sits in a collection and has back-in-stock signups (#500)', async () => {
    const storeId = await seedStore()
    const id = await withStore(app, storeId, (tx) => createProduct(tx, storeId, write))
    const { vs } = await load(storeId, id)
    const [c] = await owner
      .insert(collection)
      .values({ storeId, title: 'Glasspads', handle: 'glasspads' })
      .returning()
    if (!c || !vs[0]) throw new Error('seed')
    await owner.insert(collectionProduct).values({ storeId, collectionId: c.id, productId: id })
    await owner.execute(sql`
      insert into back_in_stock_signup (id, store_id, variant_id, product_id, email, unsubscribe_token)
      values (gen_random_uuid(), ${storeId}, ${vs[0].id}, ${id}, 'a@example.com', 'u1')`)
    expect(await withStore(app, storeId, (tx) => deleteProduct(tx, id))).toBe('deleted')
    expect(await owner.select().from(product)).toEqual([])
    expect(await owner.select().from(collectionProduct)).toEqual([])
    expect((await owner.execute(sql`select id from back_in_stock_signup`)).length).toBe(0)
    expect(await owner.select({ id: collection.id }).from(collection)).toEqual([{ id: c.id }])
  })
})
