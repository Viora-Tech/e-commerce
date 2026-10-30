/** SOURCE OF TRUTH: Inbox knowledge base service tests — WHAT: answers are added, changed, published, ordered and deleted per store, and Shopify's imported "Knowledge Base Facts" are brought over once / WHY: the AI quotes these answers to shoppers, so a second click must never duplicate them and one store must never see another's. */
import { createDb, metaobject, metaobjectDefinition, store, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { StoreContext } from '../context'
import {
  bringOverImportedFacts,
  createKnowledge,
  deleteKnowledge,
  importedFactsSource,
  knowledgeCounts,
  listKnowledge,
  publishedKnowledge,
  reorderKnowledge,
  setKnowledgePublished,
  updateKnowledge,
} from './knowledge'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

beforeEach(async () => {
  await resetDb(owner)
})

let n = 0

async function newStore() {
  const [s] = await owner
    .insert(store)
    .values({ slug: `kb-${++n}`, name: 'Key House', apps: { installed: ['inbox'] } })
    .returning()
  return s?.id as string
}

const inStore = <T>(storeId: string, fn: (ctx: StoreContext) => Promise<T>) =>
  withStore(app, storeId, (tx) => fn({ storeId, tx }))

async function importFacts(storeId: string) {
  const [def] = await owner
    .insert(metaobjectDefinition)
    .values({ storeId, type: 'shopify_knowledge_base_fact', name: 'Knowledge Base Facts' })
    .returning()
  const definitionId = def?.id as string
  await owner.insert(metaobject).values([
    {
      storeId,
      definitionId,
      handle: 'a-shipping',
      fields: { title: 'Shipping time', value_string: '3 to 5 days', published: true },
    },
    {
      storeId,
      definitionId,
      handle: 'b-gift',
      fields: { title: 'Gift wrap', suggested_value_string: 'Yes, ₹50' },
    },
    { storeId, definitionId, handle: 'c-empty', fields: { title: 'Empty' } },
  ])
}

describe('knowledge base', () => {
  it('adds, changes, publishes, orders and deletes answers', async () => {
    const s = await newStore()
    const a = await inStore(s, (ctx) =>
      createKnowledge(ctx, { title: 'COD', answer: 'Up to ₹5,000' }),
    )
    const b = await inStore(s, (ctx) =>
      createKnowledge(ctx, { title: 'Warranty', answer: 'One year', published: false }),
    )
    expect(await inStore(s, knowledgeCounts)).toEqual({ total: 2, published: 1 })
    await inStore(s, (ctx) =>
      updateKnowledge(ctx, { id: b.id, title: 'Warranty', answer: 'Two years', published: false }),
    )
    await inStore(s, (ctx) => setKnowledgePublished(ctx, { id: b.id, published: true }))
    await inStore(s, (ctx) => reorderKnowledge(ctx, [b.id, a.id]))
    expect((await inStore(s, listKnowledge)).map((e) => e.answer)).toEqual([
      'Two years',
      'Up to ₹5,000',
    ])
    expect(await withStore(app, s, publishedKnowledge)).toHaveLength(2)
    await inStore(s, (ctx) => deleteKnowledge(ctx, a.id))
    expect(await inStore(s, listKnowledge)).toHaveLength(1)
  })

  it('keeps each store’s answers to itself', async () => {
    const s1 = await newStore()
    const s2 = await newStore()
    await inStore(s1, (ctx) => createKnowledge(ctx, { title: 'COD', answer: 'Yes' }))
    expect(await inStore(s2, listKnowledge)).toEqual([])
  })

  it('brings over imported Knowledge Base Facts once; suggestions arrive unpublished', async () => {
    const s = await newStore()
    expect(await inStore(s, importedFactsSource)).toBeNull()
    await importFacts(s)
    expect(await inStore(s, importedFactsSource)).toMatchObject({ entries: 3, remaining: 3 })

    expect(await inStore(s, (ctx) => bringOverImportedFacts(ctx))).toEqual({ added: 2, skipped: 1 })
    const rows = await inStore(s, listKnowledge)
    expect(rows.map((r) => [r.title, r.published, r.imported])).toEqual([
      ['Shipping time', true, true],
      ['Gift wrap', false, true],
    ])
    expect(await inStore(s, (ctx) => bringOverImportedFacts(ctx))).toEqual({ added: 0, skipped: 1 })
    expect(await inStore(s, listKnowledge)).toHaveLength(2)
    expect(await inStore(s, importedFactsSource)).toMatchObject({ entries: 3, remaining: 1 })
  })
})
