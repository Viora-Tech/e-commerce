/** SOURCE OF TRUTH: campaign variant limit tests — WHAT: each variant's own pre-order limit saved with the campaign onto variant.preorder_override / WHY: guard the campaign page's per-variant limits (single source with the variant page) */
import { createDb, product, store, variant, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { campaignVariants } from './campaign-variants'
import { PreorderCampaignCreateSchema } from './campaigns'
import { createPreorderCampaign, updatePreorderCampaign } from './campaigns-service'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

beforeEach(async () => {
  await resetDb(owner)
})

async function seedStore() {
  const slug = `store-${Math.random().toString(36).slice(2)}`
  const [s] = await owner.insert(store).values({ slug, name: slug }).returning()
  if (!s) throw new Error('seed')
  return s.id
}

async function seedProduct(storeId: string, variants: string[]) {
  const [p] = await owner
    .insert(product)
    .values({
      storeId,
      handle: `p-${Math.random().toString(36).slice(2)}`,
      title: 'Keyboard',
      status: 'active',
    })
    .returning()
  if (!p) throw new Error('seed')
  const rows = await owner
    .insert(variant)
    .values(
      variants.map((title, position) => ({
        storeId,
        productId: p.id,
        title,
        sku: `SKU-${title}`,
        position,
      })),
    )
    .returning({ id: variant.id })
  return { productId: p.id, variantIds: rows.map((r) => r.id) }
}

const overrideOf = async (id: string) => {
  const [v] = await owner
    .select({ o: variant.preorderOverride })
    .from(variant)
    .where(eq(variant.id, id))
  return v?.o ?? null
}

describe('variant limits saved with the campaign', () => {
  it('writes each variant’s own limit on create, the field its page edits', async () => {
    const storeId = await seedStore()
    const { productId, variantIds } = await seedProduct(storeId, ['Red', 'Blue'])
    const [red, blue] = variantIds as [string, string]
    await withStore(app, storeId, (tx) =>
      createPreorderCampaign(
        { storeId, tx },
        { name: 'Launch', productIds: [productId], variantLimits: [{ variantId: red, limit: 4 }] },
      ),
    )
    expect(await overrideOf(red)).toEqual({ limit: 4 })
    expect(await overrideOf(blue)).toBeNull()
    const rows = await withStore(app, storeId, (tx) =>
      campaignVariants({ storeId, tx }, [productId]),
    )
    expect(rows).toEqual([
      { id: red, productId, title: 'Red', sku: 'SKU-Red', limit: 4 },
      { id: blue, productId, title: 'Blue', sku: 'SKU-Blue', limit: null },
    ])
  })

  it('changes and clears limits on update, keeping the variant’s other override keys', async () => {
    const storeId = await seedStore()
    const { productId, variantIds } = await seedProduct(storeId, ['Red', 'Blue'])
    const [red, blue] = variantIds as [string, string]
    const campaign = await withStore(app, storeId, (tx) =>
      createPreorderCampaign(
        { storeId, tx },
        {
          name: 'Launch',
          productIds: [productId],
          members: [{ productId, variantIds: [red], limit: null }],
          variantLimits: [{ variantId: blue, limit: 2 }],
        },
      ),
    )
    // Blue is left out of pre-orders, so its override holds `enabled: false` beside the limit.
    expect(await overrideOf(blue)).toEqual({ enabled: false, limit: 2 })
    await withStore(app, storeId, (tx) =>
      updatePreorderCampaign(
        { storeId, tx },
        {
          id: campaign.id,
          variantLimits: [
            { variantId: red, limit: 9 },
            { variantId: blue, limit: null },
          ],
        },
      ),
    )
    expect(await overrideOf(red)).toEqual({ limit: 9 })
    expect(await overrideOf(blue)).toEqual({ enabled: false })
    // An update that sends no variant limits leaves them as they are.
    await withStore(app, storeId, (tx) =>
      updatePreorderCampaign({ storeId, tx }, { id: campaign.id, name: 'Renamed' }),
    )
    expect(await overrideOf(red)).toEqual({ limit: 9 })
  })

  it('skips variants of products outside the campaign', async () => {
    const storeId = await seedStore()
    const inside = await seedProduct(storeId, ['Red'])
    const outside = await seedProduct(storeId, ['Green'])
    const [green] = outside.variantIds as [string]
    await withStore(app, storeId, (tx) =>
      createPreorderCampaign(
        { storeId, tx },
        {
          name: 'Launch',
          productIds: [inside.productId],
          variantLimits: [{ variantId: green, limit: 5 }],
        },
      ),
    )
    expect(await overrideOf(green)).toBeNull()
  })

  it('accepts only whole numbers from 1 to 1,000,000, or null', () => {
    const parse = (limit: unknown) =>
      PreorderCampaignCreateSchema.safeParse({
        name: 'Launch',
        variantLimits: [{ variantId: '00000000-0000-4000-8000-000000000001', limit }],
      }).success
    expect(parse(1)).toBe(true)
    expect(parse(null)).toBe(true)
    expect(parse(1_000_000)).toBe(true)
    for (const bad of [0, -1, 2.5, 1_000_001, '3']) expect(parse(bad)).toBe(false)
  })
})
