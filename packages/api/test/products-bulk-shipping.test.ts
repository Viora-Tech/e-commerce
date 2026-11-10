/** products.bulk { kind: 'shipping' }: "Set weight and box" on the products list. */
import { createMerchantAuth } from '@commerce/auth'
import { createDb, store, variant } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { call } from '@orpc/server'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { ApiContext } from '../src/context'
import { appRouter } from '../src/routers/_app'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const sent: { otp: string }[] = []
const auth = createMerchantAuth({
  db: app,
  baseURL: 'http://localhost:3200',
  secret: 'test-secret-test-secret-test-secret-1234',
  sendOtp: async (m) => {
    sent.push(m)
  },
})

async function merchant(email: string, slug: string) {
  await auth.api.sendVerificationOTP({ body: { email, type: 'sign-in' } })
  const res = await auth.api.signInEmailOTP({
    body: { email, otp: sent.at(-1)?.otp as string },
    asResponse: true,
  })
  const headers = new Headers({ cookie: res.headers.get('set-cookie') ?? '' })
  const org = await auth.api.createOrganization({ headers, body: { name: slug, slug } })
  await auth.api.setActiveOrganization({ headers, body: { organizationId: org?.id as string } })
  const [s] = await owner
    .insert(store)
    .values({
      slug,
      name: slug,
      organizationId: org?.id as string,
      shipping: {
        boxPresets: [
          {
            id: 'glass',
            name: 'Glasspad',
            lengthCm: 64,
            widthCm: 64,
            heightCm: 8,
            weightGrams: 500,
          },
        ],
      },
    })
    .returning()
  return {
    ctx: { db: app, auth, headers, notifications: { add: async () => undefined } } as ApiContext,
    storeId: s?.id as string,
  }
}

beforeEach(async () => {
  await resetDb(owner)
  sent.length = 0
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

type Ctx = Awaited<ReturnType<typeof merchant>>['ctx']

async function seedPad(ctx: Ctx) {
  const saved = await call(
    appRouter.products.save,
    {
      title: 'Pad',
      status: 'draft',
      options: [
        { name: 'Size', values: [{ value: 'L' }, { value: 'XL' }] },
        { name: 'Colour', values: [{ value: 'Black' }] },
      ],
      variants: ['L', 'XL'].map((size) => ({
        optionValues: [size, 'Black'],
        pricePaise: 100_000,
        onHand: 1,
      })),
    },
    { context: ctx },
  )
  if (!saved) throw new Error('save')
  return saved.id
}

const weights = async (productId: string) =>
  (
    await owner
      .select({ title: variant.title, weightGrams: variant.weightGrams, box: variant.boxPresetId })
      .from(variant)
      .where(eq(variant.productId, productId))
  ).sort((a, b) => a.title.localeCompare(b.title))

describe('products.bulk shipping', () => {
  it('sets weight and box on every variant, then only on one option value', async () => {
    const a = await merchant('bs-a@example.com', 'bs-a')
    const id = await seedPad(a.ctx)

    const all = await call(
      appRouter.products.bulk,
      { ids: [id], action: { kind: 'shipping', weightGrams: 3000, boxPresetId: 'glass' } },
      { context: a.ctx },
    )
    expect(all.changed).toBe(2)
    expect(await weights(id)).toEqual([
      { title: 'L / Black', weightGrams: 3000, box: 'glass' },
      { title: 'XL / Black', weightGrams: 3000, box: 'glass' },
    ])

    const xl = await call(
      appRouter.products.bulk,
      { ids: [id], action: { kind: 'shipping', weightGrams: 4500, optionValue: 'xl' } },
      { context: a.ctx },
    )
    expect(xl.changed).toBe(1)
    expect(await weights(id)).toEqual([
      { title: 'L / Black', weightGrams: 3000, box: 'glass' },
      { title: 'XL / Black', weightGrams: 4500, box: 'glass' },
    ])
  })

  it('refuses a box that is not in Settings › Shipping and changes nothing', async () => {
    const a = await merchant('bs-b@example.com', 'bs-b')
    const id = await seedPad(a.ctx)
    await expect(
      call(
        appRouter.products.bulk,
        { ids: [id], action: { kind: 'shipping', weightGrams: 100, boxPresetId: 'nope' } },
        { context: a.ctx },
      ),
    ).rejects.toThrow()
    expect((await weights(id)).every((v) => v.weightGrams !== 100)).toBe(true)
  })

  it("never touches another store's products", async () => {
    const a = await merchant('bs-c@example.com', 'bs-c')
    const b = await merchant('bs-d@example.com', 'bs-d')
    const id = await seedPad(a.ctx)
    const res = await call(
      appRouter.products.bulk,
      { ids: [id], action: { kind: 'shipping', weightGrams: 999 } },
      { context: b.ctx },
    )
    expect(res.changed).toBe(0)
    expect((await weights(id)).every((v) => v.weightGrams !== 999)).toBe(true)
  })
})
