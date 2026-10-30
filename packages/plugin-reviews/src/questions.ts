import { CommerceError } from '@commerce/core'
import { product, type StoreTx } from '@commerce/db'
import { and, count, desc, eq, gt, ilike, inArray, isNotNull, or, type SQL, sql } from 'drizzle-orm'
import { type QuestionStatus, reviewQuestion } from './schema'
import { ANSWER_MAX, displayName, QUESTION_MAX, QUESTION_MIN } from './settings'

/** Most questions one email may ask a day, and how many answered ones a product page lists. */
export const QUESTIONS_PER_DAY = 5
export const QUESTIONS_SHOWN = 20

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type QuestionForm = { productId: string; question: string; name: string; email: string }

/**
 * The "Ask a question" form, checked: a product id, the question (5 to 500 characters), a name
 * and an email (for the "answered" note; never shown). The field that is wrong, otherwise.
 */
export function parseQuestionForm(
  form: FormData,
): { ok: true; value: QuestionForm } | { ok: false; field: string } {
  const text = (key: string) => {
    const v = form.get(key)
    return typeof v === 'string' ? v.trim() : ''
  }
  const productId = text('product_id')
  const question = text('question').replace(/\s+/g, ' ')
  const name = text('name').slice(0, 60)
  const email = text('email').toLowerCase()
  if (!/^[0-9a-f-]{36}$/i.test(productId)) return { ok: false, field: 'product' }
  if (question.length < QUESTION_MIN || question.length > QUESTION_MAX) {
    return { ok: false, field: 'question' }
  }
  if (!name) return { ok: false, field: 'name' }
  if (!EMAIL.test(email) || email.length > 200) return { ok: false, field: 'email' }
  return { ok: true, value: { productId, question, name, email } }
}

/** Why a question was not saved: no such product, or this email asked enough today. */
export class QuestionRejected extends CommerceError {
  readonly reason: 'product' | 'limit'
  constructor(reason: 'product' | 'limit') {
    super('QUESTION_REJECTED', `question not taken: ${reason}`)
    this.reason = reason
  }
}

/**
 * Saves a shopper's question, waiting for the merchant (`pending`): only active products, at
 * most `QUESTIONS_PER_DAY` per email a day. The name is stored as shown (first name, last
 * initial); the email stays private.
 */
export async function askQuestion(
  tx: StoreTx,
  storeId: string,
  input: QuestionForm & { customerId?: string | null },
  now: Date = new Date(),
): Promise<{ id: string }> {
  const [p] = await tx
    .select({ id: product.id })
    .from(product)
    .where(and(eq(product.id, input.productId), eq(product.status, 'active')))
  if (!p) throw new QuestionRejected('product')
  const [today] = await tx
    .select({ n: count() })
    .from(reviewQuestion)
    .where(
      and(
        sql`lower(${reviewQuestion.askerEmail}) = ${input.email.toLowerCase()}`,
        gt(reviewQuestion.createdAt, new Date(now.getTime() - 24 * 60 * 60 * 1000)),
      ),
    )
  if ((today?.n ?? 0) >= QUESTIONS_PER_DAY) throw new QuestionRejected('limit')
  const [row] = await tx
    .insert(reviewQuestion)
    .values({
      storeId,
      productId: input.productId,
      customerId: input.customerId ?? null,
      question: input.question.slice(0, QUESTION_MAX),
      askerName: displayName(input.name),
      askerEmail: input.email.toLowerCase(),
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: reviewQuestion.id })
  if (!row) throw new CommerceError('QUESTION_NOT_SAVED', 'question not saved')
  return row
}

export type QuestionListInput = {
  page: number
  perPage: number
  status?: QuestionStatus | undefined
  /** Waiting for an answer: no answer yet, whatever the status. */
  unanswered?: boolean | undefined
  productId?: string | undefined
  q?: string | undefined
}

/** One page of questions for the admin's Questions tab, newest first, with the tab counts. */
export async function listQuestions(tx: StoreTx, input: QuestionListInput) {
  const where: (SQL | undefined)[] = [
    input.status ? eq(reviewQuestion.status, input.status) : undefined,
    input.unanswered ? sql`${reviewQuestion.answer} is null` : undefined,
    input.productId ? eq(reviewQuestion.productId, input.productId) : undefined,
    input.q
      ? or(ilike(reviewQuestion.question, `%${input.q}%`), ilike(product.title, `%${input.q}%`))
      : undefined,
  ]
  const filter = and(...where)
  const rows = await tx
    .select({
      id: reviewQuestion.id,
      question: reviewQuestion.question,
      askerName: reviewQuestion.askerName,
      status: reviewQuestion.status,
      answer: reviewQuestion.answer,
      answeredAt: reviewQuestion.answeredAt,
      createdAt: reviewQuestion.createdAt,
      productId: reviewQuestion.productId,
      productTitle: product.title,
      productHandle: product.handle,
    })
    .from(reviewQuestion)
    .innerJoin(product, eq(product.id, reviewQuestion.productId))
    .where(filter)
    .orderBy(desc(reviewQuestion.createdAt))
    .limit(input.perPage)
    .offset((input.page - 1) * input.perPage)
  const [total] = await tx
    .select({ n: count() })
    .from(reviewQuestion)
    .innerJoin(product, eq(product.id, reviewQuestion.productId))
    .where(filter)
  const byStatus = await tx
    .select({ status: reviewQuestion.status, n: count() })
    .from(reviewQuestion)
    .groupBy(reviewQuestion.status)
  const [unanswered] = await tx
    .select({ n: count() })
    .from(reviewQuestion)
    .where(sql`${reviewQuestion.answer} is null and ${reviewQuestion.status} <> 'hidden'`)
  const counts = { pending: 0, published: 0, hidden: 0 }
  for (const s of byStatus) counts[s.status] = s.n
  return { rows, total: total?.n ?? 0, counts, unanswered: unanswered?.n ?? 0 }
}

/**
 * The store's answer. `publish` shows the question and answer on the product page; an empty
 * answer removes it and takes the question off the page.
 */
export async function answerQuestion(
  tx: StoreTx,
  id: string,
  input: { answer: string; publish: boolean },
  now: Date = new Date(),
): Promise<{ status: QuestionStatus }> {
  const answer = input.answer.trim().slice(0, ANSWER_MAX)
  const status: QuestionStatus = answer ? (input.publish ? 'published' : 'pending') : 'pending'
  const [row] = await tx
    .update(reviewQuestion)
    .set({
      answer: answer || null,
      answeredAt: answer ? now : null,
      status,
      publishedAt: status === 'published' ? now : null,
      updatedAt: now,
    })
    .where(eq(reviewQuestion.id, id))
    .returning({ status: reviewQuestion.status })
  if (!row) throw new CommerceError('NOT_FOUND', 'Question not found')
  return row
}

/**
 * Publish, hide, or move back to waiting, one or many. A question without an answer cannot go
 * live (it would show an empty answer), so publishing skips it.
 */
export async function setQuestionStatus(
  tx: StoreTx,
  ids: string[],
  status: QuestionStatus,
  now: Date = new Date(),
): Promise<number> {
  if (ids.length === 0) return 0
  const rows = await tx
    .update(reviewQuestion)
    .set({
      status,
      updatedAt: now,
      ...(status === 'published' ? { publishedAt: now } : {}),
    })
    .where(
      and(
        inArray(reviewQuestion.id, ids),
        status === 'published' ? isNotNull(reviewQuestion.answer) : undefined,
      ),
    )
    .returning({ id: reviewQuestion.id })
  return rows.length
}

export async function deleteQuestions(tx: StoreTx, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0
  const rows = await tx
    .delete(reviewQuestion)
    .where(inArray(reviewQuestion.id, ids))
    .returning({ id: reviewQuestion.id })
  return rows.length
}

/** The answered, published questions a product page shows, newest answer first. */
export async function publishedQuestions(tx: StoreTx, productId: string) {
  const rows = await tx
    .select({
      id: reviewQuestion.id,
      question: reviewQuestion.question,
      name: reviewQuestion.askerName,
      answer: reviewQuestion.answer,
      answeredAt: reviewQuestion.answeredAt,
    })
    .from(reviewQuestion)
    .where(
      and(
        eq(reviewQuestion.productId, productId),
        eq(reviewQuestion.status, 'published'),
        isNotNull(reviewQuestion.answer),
      ),
    )
    .orderBy(desc(reviewQuestion.answeredAt))
    .limit(QUESTIONS_SHOWN)
  return rows.map((r) => ({
    id: r.id,
    question: r.question,
    name: r.name,
    answer: r.answer ?? '',
    answeredAt: (r.answeredAt ?? new Date(0)).toISOString(),
  }))
}
