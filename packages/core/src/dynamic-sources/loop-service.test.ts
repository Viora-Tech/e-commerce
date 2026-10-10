/** SOURCE OF TRUTH: list binding loader tests (database) — content type rows, product rows, limits, RLS, Save's loop check */
import { createDb, type StoreTx, store, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createDefinition, createEntry } from '../metaobjects/service'
import { type LoopProduct, loadLoopValues } from './loop-service'
import { applyLoops, type LoopSpec } from './loops'
import { assertTemplateBindings, InvalidBindings } from './service'

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

async function seedStore(slug: string) {
  const [s] = await owner.insert(store).values({ slug, name: slug }).returning()
  if (!s) throw new Error('seed')
  return s.id
}

async function seedFaq(storeId: string, count: number, storefrontAccess = true) {
  await inStore(storeId, async (tx) => {
    const def = await createDefinition(tx, storeId, {
      name: 'FAQ',
      type: 'faq',
      displayNameKey: 'question',
      fields: [
        {
          key: 'question',
          name: 'Question',
          type: 'single_line_text',
          list: false,
          required: true,
        },
        { key: 'answer', name: 'Answer', type: 'multi_line_text', list: false, required: false },
      ],
      storefrontAccess,
    })
    for (let i = 1; i <= count; i++) {
      await createEntry(tx, storeId, {
        definitionId: def.id,
        handle: `q-${i}`,
        status: i === 2 ? 'draft' : 'active',
        fields: { question: `Question ${i}?`, answer: `Answer ${i}` },
      })
    }
  })
}

const faq = (limit: number): LoopSpec => ({
  source: 'metaobject:faq',
  limit,
  map: { question: { from: 'question', kind: 'text' }, answer: { from: 'answer', kind: 'text' } },
})

describe('loadLoopValues', () => {
  it('reads active entries in order, capped at the limit, and only this store’s', async () => {
    const a = await seedStore('a')
    const b = await seedStore('b')
    await seedFaq(a, 4)
    await seedFaq(b, 3)
    const values = await inStore(a, (tx) => loadLoopValues(tx, [faq(2), faq(10)]))
    expect(values['metaobject:faq#2']?.map((r) => r.question?.value)).toEqual([
      'Question 1?',
      'Question 3?',
    ])
    // The draft entry is left out; store b's entries never appear.
    expect(values['metaobject:faq#10']?.map((r) => r.question?.value)).toEqual([
      'Question 1?',
      'Question 3?',
      'Question 4?',
    ])
  })

  it('leaves out content types hidden from the storefront', async () => {
    const a = await seedStore('a')
    await seedFaq(a, 2, false)
    const values = await inStore(a, (tx) => loadLoopValues(tx, [faq(5)]))
    expect(values).toEqual({})
  })

  it('reads a collection’s products through the storefront’s loader and maps price and image', async () => {
    const a = await seedStore('a')
    const products: LoopProduct[] = [
      {
        handle: 'mug',
        title: 'Mug',
        vendor: 'Studio',
        productType: null,
        pricePaise: 49900,
        mrpPaise: 59900,
        images: [{ url: 'https://cdn.test/mug.jpg', alt: null }],
      },
    ]
    const asked: [string, number][] = []
    const spec: LoopSpec = {
      source: 'collection:kitchen.products',
      limit: 8,
      map: {
        title: { from: 'title', kind: 'text' },
        price: { from: 'price', kind: 'text' },
        image: { from: 'featured_image', kind: 'image' },
        link: { from: 'url', kind: 'url' },
      },
    }
    const values = await inStore(a, (tx) =>
      loadLoopValues(tx, [spec], {
        collectionProducts: async (handle, limit) => {
          asked.push([handle, limit])
          return products
        },
      }),
    )
    expect(asked).toEqual([['kitchen', 8]])
    const filled = applyLoops(
      { content: [{ type: 'X', props: { items: { $loop: spec } } }] },
      values,
    )
    expect(filled.content[0]?.props.items).toEqual([
      {
        title: 'Mug',
        price: '₹499',
        image: { url: 'https://cdn.test/mug.jpg', alt: 'Mug' },
        link: '/products/mug',
      },
    ])
  })
})

describe('Save checks loops', () => {
  it('refuses a loop over a content type this store does not show', async () => {
    const a = await seedStore('a')
    await seedFaq(a, 1)
    const data = (source: string) => ({
      root: { props: {} },
      content: [{ type: 'FaqSplit', props: { id: 'f', items: { $loop: { ...faq(3), source } } } }],
    })
    await inStore(a, (tx) =>
      assertTemplateBindings(tx, [{ template: 'page', data: data('metaobject:faq') }]),
    )
    await expect(
      inStore(a, (tx) =>
        assertTemplateBindings(tx, [{ template: 'page', data: data('metaobject:team') }]),
      ),
    ).rejects.toBeInstanceOf(InvalidBindings)
  })
})
