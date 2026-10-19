import { aiMonth } from '@commerce/ai'
import { createMerchantAuth } from '@commerce/auth'
import { createMemoryRateLimitStore } from '@commerce/core'
import {
  aiSettings,
  aiUsage,
  cart,
  cartLine,
  createDb,
  inventoryLevel,
  media,
  order,
  orderLine,
  product,
  role,
  store,
  storeMember,
  variant,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { call } from '@orpc/server'
import { and, eq } from 'drizzle-orm'
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ApiContext } from '../src/context'
import { appRouter } from '../src/routers/_app'
import type { AssistantEvent } from '../src/services/ai/assistant/assistant'
import { storeTools } from '../src/services/ai/store-tools'

/*
 * The AI engine against the test database, never a real provider: AI_PROVIDER=mock uses the
 * engine's built-in fake model (the AI SDK's MockLanguageModelV4), and the tool tests call
 * the store tools directly.
 */

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

const AI_KEYS = [
  'AI_PROVIDER',
  'AI_GATEWAY_API_KEY',
  'OPENROUTER_API_KEY',
  'AI_MODEL',
  'AI_MODEL_STRONG',
  'AI_UNLIMITED_STORES',
] as const
const savedEnv = Object.fromEntries(AI_KEYS.map((k) => [k, process.env[k]]))

function setAiEnv(values: Partial<Record<(typeof AI_KEYS)[number], string>>) {
  for (const key of AI_KEYS) delete process.env[key]
  Object.assign(process.env, values)
}

async function signIn(email: string) {
  await auth.api.sendVerificationOTP({ body: { email, type: 'sign-in' } })
  const res = await auth.api.signInEmailOTP({
    body: { email, otp: sent.at(-1)?.otp as string },
    asResponse: true,
  })
  return new Headers({ cookie: res.headers.get('set-cookie') ?? '' })
}

function ctx(headers: Headers, extra: Partial<ApiContext> = {}): ApiContext {
  return {
    db: app,
    auth,
    headers,
    notifications: { add: async () => undefined },
    rateLimit: createMemoryRateLimitStore(),
    ...extra,
  }
}

async function merchant(email: string, slug: string) {
  const headers = await signIn(email)
  const org = await auth.api.createOrganization({ headers, body: { name: slug, slug } })
  await auth.api.setActiveOrganization({ headers, body: { organizationId: org?.id as string } })
  const [s] = await owner
    .insert(store)
    .values({ slug, name: `Store ${slug}`, organizationId: org?.id as string })
    .returning()
  return { headers, ctx: ctx(headers), storeId: s?.id as string, organizationId: org?.id as string }
}

/** Adds a member on the system `staff` role (orders and analytics, no product writes, no settings). */
async function staffOf(boss: Awaited<ReturnType<typeof merchant>>) {
  await call(appRouter.staff.me, {}, { context: boss.ctx })
  const headers = await signIn('helper@example.com')
  const session = await auth.api.getSession({ headers })
  const userId = session?.user.id as string
  await auth.api.addMember({
    body: { userId, role: 'member', organizationId: boss.organizationId },
  })
  await auth.api.setActiveOrganization({ headers, body: { organizationId: boss.organizationId } })
  const [r] = await owner
    .select()
    .from(role)
    .where(and(eq(role.storeId, boss.storeId), eq(role.slug, 'staff')))
  await owner.insert(storeMember).values({ storeId: boss.storeId, userId, roleId: r?.id as string })
  return ctx(headers)
}

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000)

async function collect(events: AsyncIterable<AssistantEvent>): Promise<AssistantEvent[]> {
  const out: AssistantEvent[] = []
  for await (const event of events) out.push(event)
  return out
}

async function seedCatalog(storeId: string, title: string, onHand: number) {
  const [p] = await owner
    .insert(product)
    .values({ storeId, handle: title.toLowerCase(), title, status: 'active' })
    .returning()
  const [v] = await owner
    .insert(variant)
    .values({ storeId, productId: p?.id as string, title: 'Default', pricePaise: 100000 })
    .returning()
  await owner.insert(inventoryLevel).values({ storeId, variantId: v?.id as string, onHand })
  return v?.id as string
}

const writeInput = { title: 'Glide Pro Mouse', notes: 'Weighs 58 g. USB-C cable.' }

beforeEach(async () => {
  await resetDb(owner)
  sent.length = 0
  setAiEnv({ AI_PROVIDER: 'mock' })
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

describe('AI off', () => {
  it('hides every AI button and refuses AI calls when no key is configured', async () => {
    setAiEnv({})
    const a = await merchant('a@example.com', 'ai-off')
    expect(await call(appRouter.ai.status, undefined, { context: a.ctx })).toEqual({
      configured: false,
      productWriter: false,
      assistant: false,
      bulkWriter: false,
      documentReader: false,
    })
    await expect(
      call(appRouter.ai.writeProduct, writeInput, { context: a.ctx }),
    ).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
      data: { reason: 'ai_off' },
    })
    const settings = await call(appRouter.ai.settings, undefined, { context: a.ctx })
    expect(settings).toMatchObject({ configured: false, provider: null, plan: 'starter' })
  })
})

describe('product writer', () => {
  it('suggests copy without saving anything, and meters the call and its tokens', async () => {
    const a = await merchant('a@example.com', 'ai-writer')
    const result = await call(
      appRouter.ai.writeProduct,
      { ...writeInput, tone: 'premium', language: 'en' },
      { context: a.ctx },
    )
    expect(result.copy.seoTitle).toContain('Glide Pro Mouse')
    expect(result.copy.seoTitle.length).toBeLessThanOrEqual(70)
    expect(result.copy.highlights.length).toBeGreaterThan(0)
    expect(result.photosUsed).toBe(0)

    const products = await owner.select().from(product).where(eq(product.storeId, a.storeId))
    expect(products).toEqual([])

    const settings = await call(appRouter.ai.settings, undefined, { context: a.ctx })
    expect(settings.usage.month).toBe(aiMonth())
    expect(settings.usage.byFeature.productWriter.calls).toBe(1)
    expect(settings.usage.total.inputTokens).toBeGreaterThan(0)
    expect(settings.usage.byFeature.assistant.calls).toBe(0)
  })

  it('writes in Hindi when asked', async () => {
    const a = await merchant('a@example.com', 'ai-hindi')
    const result = await call(
      appRouter.ai.writeProduct,
      { ...writeInput, language: 'hi' },
      { context: a.ctx },
    )
    expect(result.copy.intro).toMatch(/[ऀ-ॿ]/)
  })

  it("never reads another store's photos", async () => {
    const a = await merchant('a@example.com', 'ai-photo-a')
    const b = await merchant('b@example.com', 'ai-photo-b')
    const [foreign] = await owner
      .insert(media)
      .values({
        storeId: b.storeId,
        url: 'http://localhost/x.jpg',
        key: 'stores/b/x.jpg',
        contentType: 'image/jpeg',
      })
      .returning()
    const result = await call(
      appRouter.ai.writeProduct,
      { ...writeInput, mediaIds: [foreign?.id as string] },
      { context: a.ctx },
    )
    expect(result.photosUsed).toBe(0)
  })
})

describe('settings, switches and quota', () => {
  it('turns a feature off for the store, which hides it and refuses calls', async () => {
    const a = await merchant('a@example.com', 'ai-switch')
    const saved = await call(
      appRouter.ai.saveSettings,
      { features: { productWriter: false } },
      { context: a.ctx },
    )
    expect(saved.features).toEqual({
      productWriter: false,
      assistant: true,
      bulkWriter: true,
      documentReader: true,
    })
    expect(await call(appRouter.ai.status, undefined, { context: a.ctx })).toEqual({
      configured: true,
      productWriter: false,
      assistant: true,
      bulkWriter: true,
      documentReader: true,
    })
    await expect(
      call(appRouter.ai.writeProduct, writeInput, { context: a.ctx }),
    ).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
      data: { reason: 'feature_off' },
    })
  })

  it('stops a store at its monthly quota, and never the unlimited stores', async () => {
    const a = await merchant('a@example.com', 'ai-quota')
    await owner.insert(aiSettings).values({ storeId: a.storeId, plan: 'free' })
    await owner
      .insert(aiUsage)
      .values({ storeId: a.storeId, month: aiMonth(), feature: 'askStore', calls: 30 })
    await expect(
      call(appRouter.ai.writeProduct, writeInput, { context: a.ctx }),
    ).rejects.toMatchObject({
      code: 'TOO_MANY_REQUESTS',
      data: { reason: 'quota', limit: 'calls' },
    })
    // Last month's usage does not count.
    await owner.update(aiUsage).set({ month: '2000-01' }).where(eq(aiUsage.storeId, a.storeId))
    await expect(
      call(appRouter.ai.writeProduct, writeInput, { context: a.ctx }),
    ).resolves.toBeTruthy()

    await owner
      .insert(aiUsage)
      .values({ storeId: a.storeId, month: aiMonth(), feature: 'askStore', calls: 500 })
    setAiEnv({ AI_PROVIDER: 'mock', AI_UNLIMITED_STORES: 'ai-quota' })
    await expect(
      call(appRouter.ai.writeProduct, writeInput, { context: a.ctx }),
    ).resolves.toBeTruthy()
    const settings = await call(appRouter.ai.settings, undefined, { context: a.ctx })
    expect(settings.plan).toBe('pro')
    expect(settings.quota).toMatchObject({ calls: null, tokens: null })
  })

  it('rate limits bursts per store (20 per 5 minutes)', async () => {
    const a = await merchant('a@example.com', 'ai-burst')
    const context = ctx(a.headers, { rateLimit: createMemoryRateLimitStore() })
    for (let i = 0; i < 20; i++) {
      await call(appRouter.ai.writeProduct, writeInput, { context })
    }
    await expect(call(appRouter.ai.writeProduct, writeInput, { context })).rejects.toMatchObject({
      code: 'TOO_MANY_REQUESTS',
      data: { reason: 'rate_limit' },
    })
  })
})

describe('permissions', () => {
  it('lets staff ask questions but not write products or open AI settings', async () => {
    const boss = await merchant('boss@example.com', 'ai-perm')
    const staff = await staffOf(boss)
    expect(await call(appRouter.ai.status, undefined, { context: staff })).toEqual({
      configured: true,
      productWriter: false,
      assistant: true,
      bulkWriter: false,
      // The staff role may write inventory, so it may have bills read.
      documentReader: true,
    })
    await expect(
      call(appRouter.ai.writeProduct, writeInput, { context: staff }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
    await expect(call(appRouter.ai.settings, undefined, { context: staff })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
    await expect(
      call(appRouter.ai.saveSettings, { features: { assistant: false } }, { context: staff }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    const events = await collect(
      await call(
        appRouter.ai.assistant,
        { message: 'How were sales this week?' },
        { context: staff },
      ),
    )
    expect(events.at(-1)).toEqual({ type: 'done' })
  })
})

describe('assistant: answering questions', () => {
  it('streams an answer whose numbers come from the store tools, and meters it', async () => {
    const a = await merchant('a@example.com', 'ai-ask')
    await owner.insert(order).values({
      storeId: a.storeId,
      number: 1,
      subtotalPaise: 245000,
      totalPaise: 245000,
      status: 'open',
      paymentStatus: 'paid',
      placedAt: new Date(),
    })
    const events = await collect(
      await call(
        appRouter.ai.assistant,
        { message: 'How were sales this week?' },
        { context: a.ctx },
      ),
    )
    const sources = events.filter((e) => e.type === 'source')
    expect(sources.map((s) => s.status)).toEqual(['running', 'done'])
    expect(sources[1]).toMatchObject({ tool: 'salesSummary' })
    const done = sources[1] as Extract<AssistantEvent, { type: 'source' }>
    expect(done.facts).toContainEqual({ label: 'Sales, last 7 days', value: '₹2,450' })
    const text = events.flatMap((e) => (e.type === 'text' ? [e.delta] : [])).join('')
    expect(text).toContain('₹2,450')
    expect(events.at(-1)).toEqual({ type: 'done' })

    const settings = await call(appRouter.ai.settings, undefined, { context: a.ctx })
    expect(settings.usage.byFeature.assistant.calls).toBe(1)
    expect(settings.usage.byFeature.assistant.outputTokens).toBeGreaterThan(0)
  })
})

describe('store tools (read-only, against the database)', () => {
  it("answer from the caller's store only", async () => {
    const a = await merchant('a@example.com', 'tools-a')
    const b = await merchant('b@example.com', 'tools-b')
    const lowA = await seedCatalog(a.storeId, 'Mouse', 2)
    await seedCatalog(a.storeId, 'Keyboard', 40)
    await seedCatalog(b.storeId, 'Secret', 1)
    const [o1, o2] = await owner
      .insert(order)
      .values([
        {
          storeId: a.storeId,
          number: 7,
          subtotalPaise: 100000,
          totalPaise: 100000,
          status: 'open',
          paymentStatus: 'paid',
          fulfillmentStatus: 'unfulfilled',
          placedAt: daysAgo(3),
        },
        {
          storeId: a.storeId,
          number: 8,
          subtotalPaise: 50000,
          totalPaise: 50000,
          status: 'open',
          paymentStatus: 'unpaid',
          fulfillmentStatus: 'unfulfilled',
          placedAt: new Date(),
        },
      ])
      .returning()
    await owner.insert(orderLine).values([
      {
        storeId: a.storeId,
        orderId: o1?.id as string,
        variantId: lowA,
        quantity: 2,
        unitPricePaise: 50000,
      },
      {
        storeId: a.storeId,
        orderId: o2?.id as string,
        variantId: lowA,
        quantity: 1,
        unitPricePaise: 50000,
      },
    ])
    await owner.insert(order).values({
      storeId: b.storeId,
      number: 7,
      subtotalPaise: 9_999_900,
      totalPaise: 9_999_900,
      status: 'open',
      paymentStatus: 'paid',
      placedAt: daysAgo(3),
    })
    const [abandoned] = await owner
      .insert(cart)
      .values({ storeId: a.storeId, email: 'x@example.com', updatedAt: daysAgo(1) })
      .returning()
    await owner.insert(cartLine).values({
      storeId: a.storeId,
      cartId: abandoned?.id as string,
      variantId: lowA,
      quantity: 1,
      unitPricePaise: 30000,
    })

    const tools = storeTools({
      db: app,
      store: { name: 'A', slug: 'tools-a', currency: 'INR', timezone: 'Asia/Kolkata' },
      now: () => new Date(),
    })
    const runtime = {
      storeId: a.storeId,
      userId: 'u',
      plan: 'starter' as const,
      feature: 'assistant' as const,
    }
    const run = async (name: string, input: unknown) =>
      JSON.stringify(await tools[name]?.run(input, runtime))

    const sales = await run('salesSummary', { days: 7 })
    expect(sales).toContain('₹1,500')
    expect(sales).not.toContain('99,999')

    const top = await run('topProducts', { days: 30, limit: 5 })
    expect(top).toContain('Mouse')
    expect(top).toContain('3 sold, ₹1,500')

    const low = await run('lowStock', { threshold: 5, limit: 10 })
    expect(low).toContain('Mouse')
    expect(low).not.toContain('Keyboard')
    expect(low).not.toContain('Secret')

    const pending = await run('pendingOrders', { olderThanDays: 2 })
    expect(pending).toContain('1 orders, ₹1,000')
    expect(pending).toContain('#7')
    expect(pending).not.toContain('#8')

    const carts = await run('abandonedCheckouts', { days: 7 })
    expect(carts).toContain('₹300')
    // No contact details ever reach the model.
    expect(carts).not.toContain('x@example.com')
  })
})
