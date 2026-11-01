import { outboxEvent, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import {
  answerQuestion,
  askQuestion,
  listQuestions,
  parseQuestionForm,
  publishedQuestions,
  QUESTIONS_PER_DAY,
  setQuestionStatus,
} from '../src/questions'
import { addProduct, app, owner, seedStore } from './helpers'

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

const form = (fields: Record<string, string>) => {
  const f = new FormData()
  for (const [k, v] of Object.entries(fields)) f.set(k, v)
  return f
}
const productId = '0190f3a2-5b6c-7d8e-9f00-112233445566'

describe('parseQuestionForm', () => {
  it('takes a clean question and names the wrong field otherwise', () => {
    expect(
      parseQuestionForm(
        form({
          product_id: productId,
          question: '  Does it  fit a 13 inch laptop? ',
          name: 'Asha Kumar',
          email: 'Asha@Example.com',
        }),
      ),
    ).toEqual({
      ok: true,
      value: {
        productId,
        question: 'Does it fit a 13 inch laptop?',
        name: 'Asha Kumar',
        email: 'asha@example.com',
      },
    })
    const base = { product_id: productId, question: 'Is it washable?', name: 'A', email: 'a@b.co' }
    expect(parseQuestionForm(form({ ...base, question: 'Hm?' }))).toEqual({
      ok: false,
      field: 'question',
    })
    expect(parseQuestionForm(form({ ...base, email: 'nope' }))).toEqual({
      ok: false,
      field: 'email',
    })
    expect(parseQuestionForm(form({ ...base, name: ' ' }))).toEqual({ ok: false, field: 'name' })
  })
})

describe('product questions', () => {
  it('waits for an answer, then shows once answered and published', async () => {
    const storeId = await seedStore()
    const p = await addProduct(storeId, 'veil')
    const ask = (question: string) =>
      withStore(app, storeId, (tx) =>
        askQuestion(tx, storeId, {
          productId: p.productId,
          question,
          name: 'Asha Kumar',
          email: 'asha@example.com',
        }),
      )
    const { id } = await ask('Is it washable?')
    expect(await withStore(app, storeId, (tx) => publishedQuestions(tx, p.productId))).toEqual([])

    // Publishing without an answer does nothing: an empty answer never shows.
    expect(await withStore(app, storeId, (tx) => setQuestionStatus(tx, [id], 'published'))).toBe(0)
    const list = await withStore(app, storeId, (tx) =>
      listQuestions(tx, { page: 1, perPage: 20, unanswered: true }),
    )
    expect(list.rows.map((r) => r.askerName)).toEqual(['Asha K.'])
    expect(list.unanswered).toBe(1)

    await withStore(app, storeId, (tx) =>
      answerQuestion(tx, id, { answer: 'Yes, by hand.', publish: true }),
    )
    const shown = await withStore(app, storeId, (tx) => publishedQuestions(tx, p.productId))
    expect(shown).toMatchObject([
      { question: 'Is it washable?', answer: 'Yes, by hand.', name: 'Asha K.' },
    ])

    await withStore(app, storeId, (tx) => setQuestionStatus(tx, [id], 'hidden'))
    expect(await withStore(app, storeId, (tx) => publishedQuestions(tx, p.productId))).toEqual([])

    // The store heard about the question once; the asker about the answer once, even after
    // the question is hidden and published again.
    await withStore(app, storeId, (tx) => setQuestionStatus(tx, [id], 'published'))
    const events = await withStore(app, storeId, (tx) =>
      tx
        .select({ type: outboxEvent.type })
        .from(outboxEvent)
        .where(eq(outboxEvent.storeId, storeId)),
    )
    const types = events.map((e) => e.type)
    expect(types.filter((t) => t === 'review.question_asked')).toHaveLength(1)
    expect(types.filter((t) => t === 'review.question_answered')).toHaveLength(1)
  })

  it('limits questions per email a day and refuses unknown products', async () => {
    const storeId = await seedStore()
    const p = await addProduct(storeId, 'veil')
    const draft = await addProduct(storeId, 'soon', { status: 'draft' })
    const ask = (pid: string) =>
      withStore(app, storeId, (tx) =>
        askQuestion(tx, storeId, {
          productId: pid,
          question: 'Is it washable?',
          name: 'A',
          email: 'a@example.com',
        }),
      )
    await expect(ask(draft.productId)).rejects.toMatchObject({ reason: 'product' })
    for (let i = 0; i < QUESTIONS_PER_DAY; i++) await ask(p.productId)
    await expect(ask(p.productId)).rejects.toMatchObject({ reason: 'limit' })
  })
})
