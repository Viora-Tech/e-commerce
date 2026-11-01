'use client'

import { type FormEvent, useState } from 'react'
import { reviewsWidgetsContent as copy } from '../../../data/reviews-widgets'
import type { PublicQuestion } from '../../../types'

type ProductQuestionsProps = {
  heading: string
  productId: string
  questions: PublicQuestion[]
  /** Questions shown before "Show all". */
  limit: number
}

type Result = { ok: boolean; error?: string }

/** The hidden field the review forms add (`REVIEW_HONEYPOT`); a person never fills it. */
const HONEYPOT = 'review_website'

const FIELD =
  'w-full rounded-md border border-line bg-bg px-3 py-2.5 text-base text-ink outline-none transition-[border-color] focus-visible:border-brand md:text-sm'

const errorText = (key: string | undefined): string =>
  (key && (copy.questions.errors as Record<string, string>)[key]) || copy.questions.errors.generic

/**
 * Questions and answers on a product page: the answered questions (the first few, then "Show
 * all") and an "Ask a question" form that posts to `/reviews/question`. A new question waits
 * for the store's answer; the shopper is told so.
 */
export default function ProductQuestions({
  heading,
  productId,
  questions,
  limit,
}: ProductQuestionsProps) {
  // Hooks
  const [showAll, setShowAll] = useState(false)
  const [asking, setAsking] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  // Event handlers
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const body = new FormData(event.currentTarget)
    body.set('product_id', productId)
    setSending(true)
    setError(null)
    try {
      const res = await fetch('/reviews/question', { method: 'POST', body })
      const data = (await res.json().catch(() => null)) as Result | null
      if (data?.ok) setSent(true)
      else setError(errorText(data?.error))
    } catch {
      setError(copy.questions.errors.generic)
    } finally {
      setSending(false)
    }
  }

  // Render logic
  const shown = showAll ? questions : questions.slice(0, limit)

  return (
    <div className="flex flex-col gap-4 text-left text-ink">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="m-0 text-xl font-semibold">{heading}</h2>
        {!asking && !sent && (
          <button type="button" className="btn btn--secondary" onClick={() => setAsking(true)}>
            {copy.questions.ask}
          </button>
        )}
      </div>
      {sent ? (
        <p className="m-0 rounded-[var(--radius-m)] bg-surface px-4 py-3 text-sm">
          {copy.questions.thanks}
        </p>
      ) : asking ? (
        <form
          className="flex flex-col gap-3 rounded-[var(--radius-m)] bg-surface p-4"
          onSubmit={handleSubmit}
        >
          <label className="flex flex-col gap-1 text-sm">
            {copy.questions.question}
            <textarea
              name="question"
              required
              minLength={5}
              maxLength={500}
              rows={3}
              className={FIELD}
            />
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              {copy.questions.name}
              <input
                name="name"
                required
                maxLength={60}
                autoComplete="given-name"
                className={FIELD}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {copy.questions.email}
              <input
                name="email"
                type="email"
                required
                maxLength={200}
                autoComplete="email"
                className={FIELD}
              />
            </label>
          </div>
          <input
            type="text"
            name={HONEYPOT}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="hidden"
          />
          <p className="m-0 text-xs text-muted">{copy.questions.emailNote}</p>
          {error && (
            <p role="alert" className="m-0 text-sm text-danger">
              {error}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className="btn btn--secondary" onClick={() => setAsking(false)}>
              {copy.questions.cancel}
            </button>
            <button type="submit" className="btn btn--primary" disabled={sending}>
              {sending ? copy.questions.sending : copy.questions.send}
            </button>
          </div>
        </form>
      ) : null}
      {questions.length === 0 ? (
        <p className="m-0 text-sm text-muted">{copy.questions.none}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col divide-y divide-line p-0">
          {shown.map((q) => (
            <li key={q.id} className="flex flex-col gap-1.5 py-3 first:pt-0">
              <p className="m-0 font-semibold">
                <span className="text-muted">{copy.questions.q} </span>
                {q.question}
              </p>
              <p className="m-0 whitespace-pre-line text-sm leading-relaxed">
                <span className="font-semibold text-muted">{copy.questions.a} </span>
                {q.answer}
              </p>
              <p className="m-0 text-xs text-muted">{copy.questions.meta(q.name, q.whenLabel)}</p>
            </li>
          ))}
        </ul>
      )}
      {!showAll && questions.length > limit && (
        <button
          type="button"
          className="btn btn--secondary self-start"
          onClick={() => setShowAll(true)}
        >
          {copy.questions.showAll(questions.length)}
        </button>
      )}
    </div>
  )
}
