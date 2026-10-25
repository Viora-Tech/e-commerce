import { createMemoryRateLimitStore } from '@commerce/core'
import { aiUsage, createDb, store } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { StoreScope } from '../src/procedures'
import { refineQuery, writeValidQuery } from '../src/services/ai/query-writer'

/*
 * "Refine with AI" for the custom query editor: the model's answer is only ever text that must
 * parse. The retry path is driven by a fake `ask`; the full call runs on the engine's built-in
 * mock model (AI_PROVIDER=mock), never a real provider.
 */

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

const AI_KEYS = ['AI_PROVIDER', 'AI_GATEWAY_API_KEY', 'OPENROUTER_API_KEY'] as const
const savedEnv = Object.fromEntries(AI_KEYS.map((k) => [k, process.env[k]]))

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

beforeEach(async () => {
  await resetDb(owner)
  for (const k of AI_KEYS) delete process.env[k]
})

afterEach(() => {
  for (const k of AI_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k]
    else process.env[k] = savedEnv[k]
  }
})

const VALID = 'from sales show orders group by state limit 5'

describe('writeValidQuery', () => {
  it('returns a valid answer formatted', async () => {
    const out = await writeValidQuery(async () => VALID)
    expect(out).toEqual({
      ok: true,
      source: 'FROM sales\n  SHOW orders\n  GROUP BY state\n  SINCE -30d UNTIL today\n  LIMIT 5',
    })
  })

  it('retries once with the parser error, then accepts the fix', async () => {
    const problems: unknown[] = []
    const answers = ['FROM sales SHOW net_sale', VALID]
    const out = await writeValidQuery(async (problem) => {
      problems.push(problem)
      return answers.shift() as string
    })
    expect(out.ok).toBe(true)
    expect(problems[0]).toBeUndefined()
    expect(problems[1]).toEqual({
      query: 'FROM sales SHOW net_sale',
      error: 'line 1: Unknown field “net_sale”. Did you mean net_sales?',
    })
  })

  it('gives up after the retry with the last parse error, never anything else', async () => {
    let calls = 0
    const out = await writeValidQuery(async () => {
      calls++
      return 'DROP TABLE orders'
    })
    expect(calls).toBe(2)
    expect(out).toMatchObject({ ok: false, error: { line: 1 } })
  })
})

describe('refineQuery', () => {
  async function scopeFor(slug: string): Promise<StoreScope> {
    const [s] = await owner.insert(store).values({ slug, name: slug }).returning()
    return {
      storeId: s?.id as string,
      organizationId: 'org',
      role: 'owner',
      userId: 'user-1',
      roleId: 'role',
      roleSlug: 'owner',
      roleName: 'Owner',
      isOwner: true,
      permissions: [],
      can: () => true,
    }
  }

  it('writes a parsed query on the mock model and counts the call', async () => {
    process.env.AI_PROVIDER = 'mock'
    const scope = await scopeFor('q1')
    const out = await refineQuery(
      { db: app, scope, rateLimit: createMemoryRateLimitStore() },
      { request: 'top 5 states by sales last month', current: 'FROM sales SHOW orders' },
    )
    expect(out).toEqual({
      ok: true,
      source: expect.stringContaining('GROUP BY state'),
    })
    expect(out.ok && out.source).toContain('LIMIT 5')
    const usage = await owner.select().from(aiUsage).where(eq(aiUsage.storeId, scope.storeId))
    expect(usage.length).toBeGreaterThan(0)
  })

  it('refuses when AI is off for the platform', async () => {
    const scope = await scopeFor('q2')
    await expect(
      refineQuery(
        { db: app, scope, rateLimit: createMemoryRateLimitStore() },
        { request: 'top states', current: '' },
      ),
    ).rejects.toThrow(/not switched on/)
  })
})
