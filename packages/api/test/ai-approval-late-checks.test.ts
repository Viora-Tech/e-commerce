/** SOURCE OF TRUTH: late checks on approving an AI proposal — WHAT a product text update applies only the fields nobody edited since it was proposed (tags as a delta on today's tags), and a discount whose dates went stale is refused / WHY a proposal stays open for a day (#1717), and approving it must not overwrite the merchant's own edits or create a dead code */
import { createMerchantAuth } from '@commerce/auth'
import { createMemoryRateLimitStore, type ProductFieldsSnapshot } from '@commerce/core'
import { aiAction, createDb, discount, product, store, variant } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { call } from '@orpc/server'
import { eq } from 'drizzle-orm'
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ApiContext } from '../src/context'
import { appRouter } from '../src/routers/_app'
import { lateDateCheck, latePatch } from '../src/services/ai/assistant/actions/late-checks'
import type { AssistantEvent } from '../src/services/ai/assistant/assistant'

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

const AI_KEYS = ['AI_PROVIDER', 'AI_GATEWAY_API_KEY', 'OPENROUTER_API_KEY', 'AI_MODEL'] as const
const savedEnv = Object.fromEntries(AI_KEYS.map((k) => [k, process.env[k]]))

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
    .values({ slug, name: `Store ${slug}`, organizationId: org?.id as string })
    .returning()
  const ctx: ApiContext = {
    db: app,
    auth,
    headers,
    notifications: { add: async () => undefined },
    rateLimit: createMemoryRateLimitStore(),
  }
  return { ctx, storeId: s?.id as string }
}

async function proposal(context: ApiContext, message: string, entityId?: string) {
  const events: AssistantEvent[] = []
  const stream = await call(
    appRouter.ai.assistant,
    { message, ...(entityId ? { page: { page: 'product', entityId } as never } : {}) },
    { context },
  )
  for await (const event of stream) events.push(event)
  const found = events.find((e) => e.type === 'proposal')
  if (found?.type !== 'proposal') throw new Error(`no proposal in ${JSON.stringify(events)}`)
  return found.action
}

/** "8 Nov" for today plus `days`, as a merchant would type it. */
function dayMonth(days: number) {
  const d = new Date(Date.now() + days * 86_400_000)
  return `${d.getUTCDate()} ${d.toLocaleString('en', { month: 'short', timeZone: 'UTC' })}`
}

const readProduct = async (id: string) =>
  (await owner.select().from(product).where(eq(product.id, id)))[0]

beforeEach(async () => {
  await resetDb(owner)
  sent.length = 0
  for (const key of AI_KEYS) delete process.env[key]
  process.env.AI_PROVIDER = 'mock'
})

afterEach(() => {
  for (const key of AI_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key]
    else process.env[key] = savedEnv[key]
  }
})

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

describe('product text update approved late', () => {
  async function hindiProposal(slug: string) {
    const a = await merchant(`${slug}@example.com`, slug)
    const [p] = await owner
      .insert(product)
      .values({
        storeId: a.storeId,
        handle: 'glide-mouse',
        title: 'Glide Mouse',
        status: 'active',
        seoTitle: 'Old title',
      })
      .returning()
    const id = p?.id as string
    await owner
      .insert(variant)
      .values({ storeId: a.storeId, productId: id, title: 'Default', pricePaise: 199900 })
    const action = await proposal(a.ctx, 'Write this product in Hindi', id)
    expect(action.preview.rows.map((r) => r.label)).toEqual([
      'Description',
      'Search title',
      'Search description',
    ])
    return { a, id, action }
  }

  it('keeps a field edited since the proposal and applies the rest, saying what it skipped', async () => {
    const { a, id, action } = await hindiProposal('late-some')
    await owner.update(product).set({ seoTitle: 'Staff wrote this' }).where(eq(product.id, id))

    const done = await call(appRouter.ai.approveAction, { id: action.id }, { context: a.ctx })
    expect(done.status).toBe('executed')
    expect(done.message).toBe(
      'Glide Mouse updated (description, search description only: search title was edited after this was proposed)',
    )
    const after = await readProduct(id)
    expect(after?.seoTitle).toBe('Staff wrote this')
    expect(after?.seoDescription).toMatch(/[ऀ-ॿ]/)
    expect(JSON.stringify(after?.description)).toMatch(/[ऀ-ॿ]/)
  })

  it('refuses when every field was edited since, and changes nothing', async () => {
    const { a, id, action } = await hindiProposal('late-all')
    const edited = {
      seoTitle: 'Staff title',
      seoDescription: 'Staff description',
      description: { root: { children: [], type: 'root' } },
    }
    await owner.update(product).set(edited).where(eq(product.id, id))

    const done = await call(appRouter.ai.approveAction, { id: action.id }, { context: a.ctx })
    expect(done.status).toBe('failed')
    expect(done.error).toBe(
      'Nothing was changed on Glide Mouse: description, search title, search description were edited after this was proposed. Ask again to start from the current text.',
    )
    expect(await readProduct(id)).toMatchObject(edited)
  })

  it('applies tags as the proposed add and remove on today’s tags', () => {
    const now: ProductFieldsSnapshot = {
      productId: 'p',
      title: 'Glide Mouse',
      description: null,
      seoTitle: null,
      seoDescription: null,
      seoKeywords: [],
      // Proposed on ['wired', 'black']: remove "wired", add "wireless". Staff added "sale" since.
      tags: ['wired', 'black', 'sale'],
      mediaAlt: [],
    }
    const out = latePatch(
      {
        productId: 'p',
        title: 'Glide Mouse',
        patch: { tags: ['black', 'wireless'] },
        before: {},
        tags: { add: ['wireless'], remove: ['wired'] },
      },
      now,
    )
    expect(out.patch).toEqual({ tags: ['black', 'sale', 'wireless'] })
    expect(out.applied).toEqual(['tags'])
    // Someone already made the same tag change: nothing left to do, case does not matter.
    const same = latePatch(
      {
        productId: 'p',
        title: 'Glide Mouse',
        patch: { tags: ['black', 'wireless'] },
        before: {},
        tags: { add: ['wireless'], remove: ['wired'] },
      },
      { ...now, tags: ['Black', 'Wireless'] },
    )
    expect(same.applied).toEqual([])
    expect(same.already).toEqual(['tags'])
    // A proposal made before `before` was stored applies as proposed.
    expect(
      latePatch({ productId: 'p', title: 'x', patch: { seoTitle: 'New' } }, now).patch,
    ).toEqual({ seoTitle: 'New' })
  })
})

describe('discount approved late', () => {
  it('refuses a discount whose last day passed while it waited, and creates nothing', async () => {
    const a = await merchant('late-discount@example.com', 'late-discount')
    const action = await proposal(
      a.ctx,
      `Create discount LATE10: 10% off, ${dayMonth(0)} to ${dayMonth(1)}`,
    )
    expect(action.status).toBe('proposed')
    // Twenty-four hours on, the end date is behind us: move the stored dates back two days.
    const [row] = await owner.select().from(aiAction).where(eq(aiAction.id, action.id))
    const input = row?.input as { resolved: { discount: Record<string, unknown> } }
    const back = (v: unknown) => new Date(new Date(v as string).getTime() - 2 * 86_400_000)
    input.resolved.discount.startsAt = back(input.resolved.discount.startsAt)
    input.resolved.discount.endsAt = back(input.resolved.discount.endsAt)
    await owner.update(aiAction).set({ input }).where(eq(aiAction.id, action.id))

    const done = await call(appRouter.ai.approveAction, { id: action.id }, { context: a.ctx })
    expect(done.status).toBe('failed')
    expect(done.error).toMatch(
      /^LATE10 was not created: its last day \(.+\) passed while it waited for approval\. Ask again with new dates\.$/,
    )
    expect(await owner.select().from(discount).where(eq(discount.storeId, a.storeId))).toEqual([])
  })

  it('refuses dates that end before they start', () => {
    const env = {
      now: new Date('2026-11-15T06:00:00Z'),
      store: { name: 'S', slug: 's', currency: 'INR', timezone: 'Asia/Kolkata' },
    }
    expect(() =>
      lateDateCheck(env, {
        code: 'BACKWARDS',
        startsAt: '2026-11-20T18:30:00.000Z',
        endsAt: '2026-11-18T18:29:00.000Z',
      }),
    ).toThrow('BACKWARDS was not created: it would end (18 Nov) before it starts (21 Nov).')
    expect(() =>
      lateDateCheck(env, { code: 'OK', startsAt: null, endsAt: '2026-11-16T18:29:00.000Z' }),
    ).not.toThrow()
  })
})
