import { changeStoreCredit } from '@commerce/core'
import { customer, giftCard, storeCreditAccount, storeCreditEntry, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { asc, eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { ResourceProgress } from '../src/client'
import { connect } from '../src/connection'
import { preflightChecks } from '../src/preflight'
import { executeRun } from '../src/run'
import { importIssue, importRun } from '../src/schema'
import { createApiRun, startRun } from '../src/service'
import { CUSTOMERS } from './fixtures/graphql'
import {
  app,
  deps,
  fakeFetch,
  json,
  MemoryStorageProvider,
  owner,
  SECRET,
  seedStore,
} from './helpers'

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

const cost = {
  requestedQueryCost: 50,
  throttleStatus: { maximumAvailable: 2000, currentlyAvailable: 1900, restoreRate: 100 },
}

type State = { meeraInr: string; deny?: boolean }

const account = (id: number, amount: string, currencyCode = 'INR') => ({
  id: `gid://shopify/StoreCreditAccount/${id}`,
  balance: { amount, currencyCode },
})

/** Meera (imported) holds INR and USD credit; Ravi is not a customer here; Asha holds nothing. */
const storeCredit = (s: State) => ({
  customers: {
    pageInfo: { hasNextPage: false, endCursor: null },
    nodes: [
      {
        id: 'gid://shopify/Customer/9',
        email: 'Meera@Example.com',
        firstName: 'Meera',
        lastName: 'Iyer',
        storeCreditAccounts: { nodes: [account(71, s.meeraInr), account(72, '50.00', 'USD')] },
      },
      {
        id: 'gid://shopify/Customer/10',
        email: 'ravi@example.com',
        firstName: 'Ravi',
        lastName: null,
        storeCreditAccounts: { nodes: [account(73, '200.00')] },
      },
      {
        id: 'gid://shopify/Customer/11',
        email: 'asha@example.com',
        firstName: 'Asha',
        lastName: null,
        storeCreditAccounts: { nodes: [account(74, '0.00')] },
      },
    ],
  },
})

function shopifyFor(state: State) {
  return (query: string): Response => {
    const op = /query (\w+)/.exec(query)?.[1] ?? 'Shop'
    if (op === 'StoreCredit' && state.deny) {
      return json({
        errors: [
          {
            message: 'Access denied for storeCreditAccounts field.',
            extensions: { code: 'ACCESS_DENIED' },
          },
        ],
      })
    }
    const data: Record<string, unknown> = {
      Shop: { shop: { name: 'Waimers', myshopifyDomain: 'waimers.myshopify.com' } },
      Customers: CUSTOMERS,
      StoreCredit: storeCredit(state),
    }
    return json({ data: data[op], extensions: { cost } })
  }
}

async function setup(state: State) {
  const fetchImpl = fakeFetch(shopifyFor(state))
  const storeId = await seedStore()
  await withStore(app, storeId, (tx) =>
    connect(
      tx,
      storeId,
      { shopDomain: 'waimers.myshopify.com', accessToken: 'shpat_0123456789abcdef' },
      SECRET,
      fetchImpl,
    ),
  )
  const d = deps(storeId, new MemoryStorageProvider(), { fetch: fetchImpl, sleep: async () => {} })
  const run = await withStore(app, storeId, (tx) =>
    createApiRun(tx, storeId, {
      resources: ['customers', 'store_credit'],
      includeUnusedFiles: false,
      createdBy: null,
    }),
  )
  /** The preview, then the import. */
  await executeRun(d, run.id)
  const preview = await progressOf(run.id)
  await withStore(app, storeId, (tx) => startRun(tx, run.id))
  await executeRun(d, run.id)
  /** Import again, as "Import now" on the same run would. */
  const again = async () => {
    await withStore(app, storeId, (tx) => startRun(tx, run.id))
    await executeRun(d, run.id)
    return progressOf(run.id)
  }
  return { storeId, runId: run.id, preview, again }
}

async function progressOf(runId: string) {
  const [row] = await owner.select().from(importRun).where(eq(importRun.id, runId))
  return row
}

const left = (p: ResourceProgress | undefined) =>
  Object.fromEntries(
    (p?.left ?? []).map((l) => [`${l.reason}${l.detail ? `:${l.detail}` : ''}`, l.count]),
  )

const entries = () => owner.select().from(storeCreditEntry).orderBy(asc(storeCreditEntry.createdAt))

async function balance(): Promise<number> {
  const [a] = await owner.select().from(storeCreditAccount)
  return a?.balancePaise ?? 0
}

describe('store credit import', () => {
  it('previews, then puts the INR balance on the customer as one ledger line, never a gift card', async () => {
    const { runId, preview } = await setup({ meeraInr: '1500.00' })
    // The preview counts Ravi too: by the import his customer record would be there.
    expect(preview?.progress.store_credit).toMatchObject({ total: 3, created: 2, skipped: 1 })
    expect(preview?.progress.store_credit?.credit).toEqual({ customers: 2, amountPaise: 170000 })

    const run = await progressOf(runId)
    expect(run?.status).toBe('completed')
    const p = run?.progress.store_credit
    expect(p).toMatchObject({ total: 3, created: 1, skipped: 2, failed: 0 })
    expect(p?.credit).toEqual({ customers: 1, amountPaise: 150000 })
    expect(left(p)).toEqual({ 'store_credit_currency:USD': 1, store_credit_no_customer: 1 })

    const [meera] = await owner.select().from(customer)
    const lines = await entries()
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatchObject({
      customerId: meera?.id,
      amountPaise: 150000,
      balanceAfterPaise: 150000,
      kind: 'adjustment',
      staffEmail: null,
    })
    expect(lines[0]?.reason).toContain('Imported from Shopify (store credit)')
    expect(lines[0]?.reason).toContain('71')
    expect(await owner.select().from(giftCard)).toHaveLength(0)

    const issues = await owner.select().from(importIssue).where(eq(importIssue.runId, runId))
    const credit = issues.filter((i) => i.resource === 'store_credit').map((i) => i.message)
    expect(credit.some((m) => m.includes('USD'))).toBe(true)
    expect(credit.some((m) => m.includes('not here'))).toBe(true)
  })

  it('re-importing an unchanged balance adds nothing', async () => {
    const { again } = await setup({ meeraInr: '1500.00' })
    const run = await again()
    expect(run?.progress.store_credit).toMatchObject({ created: 0, updated: 1 })
    expect(run?.progress.store_credit?.credit).toEqual({ customers: 1, amountPaise: 150000 })
    expect(await entries()).toHaveLength(1)
    expect(await balance()).toBe(150000)
  })

  it('a changed Shopify balance adds only the difference, up or down', async () => {
    const state = { meeraInr: '1500.00' }
    const { again } = await setup(state)
    state.meeraInr = '2000.00'
    await again()
    expect((await entries()).map((e) => e.amountPaise)).toEqual([150000, 50000])
    expect(await balance()).toBe(200000)

    state.meeraInr = '500.00'
    const run = await again()
    expect((await entries()).map((e) => e.amountPaise)).toEqual([150000, 50000, -150000])
    expect(await balance()).toBe(50000)
    expect(run?.progress.store_credit?.credit).toEqual({ customers: 1, amountPaise: 50000 })
  })

  it('keeps the balance here when Shopify went down but the credit was already spent here', async () => {
    const state = { meeraInr: '1500.00' }
    const { storeId, again } = await setup(state)
    const [meera] = await owner.select().from(customer)
    await withStore(app, storeId, (tx) =>
      changeStoreCredit(
        { tx, storeId },
        {
          customerId: meera?.id as string,
          amountPaise: -140000,
          kind: 'adjustment',
          reason: 'Spent',
        },
      ),
    )
    state.meeraInr = '0.00'
    const run = await again()
    expect(await balance()).toBe(10000)
    expect(left(run?.progress.store_credit)).toMatchObject({ store_credit_used_here: 1 })
  })

  it('skips store credit with a note when the app lacks the scope, and imports the rest', async () => {
    const { runId } = await setup({ meeraInr: '1500.00', deny: true })
    const run = await progressOf(runId)
    expect(run?.status).toBe('completed')
    expect(run?.progress.customers?.created).toBe(1)
    expect(left(run?.progress.store_credit)).toEqual({ store_credit_scope: 1 })
    expect(await entries()).toHaveLength(0)
    const issues = await owner.select().from(importIssue).where(eq(importIssue.runId, runId))
    expect(issues.find((i) => i.resource === 'store_credit')?.message).toContain(
      'read_store_credit_accounts',
    )
  })

  it('warns before the import instead of blocking when the scope is missing', async () => {
    const storeId = await seedStore()
    const checks = await withStore(app, storeId, (tx) =>
      preflightChecks(tx, {
        mode: 'api',
        resources: ['customers', 'store_credit'],
        storage: { providerId: 'r2', production: true },
        scopes: {
          shopName: 'Waimers',
          granted: ['read_customers'],
          missing: ['read_store_credit_accounts'],
        },
      }),
    )
    expect(checks).toEqual([
      expect.objectContaining({ id: 'optional_scope', status: 'warn', resource: 'store_credit' }),
    ])
  })
})
