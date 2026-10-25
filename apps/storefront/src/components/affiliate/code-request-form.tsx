'use client'

import { useState, useTransition } from 'react'
import { affiliateContent } from '@/data/affiliate'
import { requestCodeAction } from '@/lib/affiliate-actions'

type CodeRequestFormProps = {
  /** Their last request, if any. */
  request: { code: string; status: 'pending' | 'approved' | 'declined' } | null
}

const copy = affiliateContent.dashboard.vanity

/** Ask the store for their own code (`asha` instead of `asha-k2`); the store approves it. */
export default function CodeRequestForm({ request }: CodeRequestFormProps) {
  // Hooks
  const [pending, start] = useTransition()
  const [code, setCode] = useState('')
  const [sent, setSent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Event handlers
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    start(async () => {
      const r = await requestCodeAction(code)
      if (r.ok) setSent(code.trim().toLowerCase())
      else setError(copy.errors[r.error] ?? copy.errors.generic ?? '')
    })
  }

  // Early returns
  const waiting = sent ?? (request?.status === 'pending' ? request.code : null)
  if (waiting)
    return (
      <p className="max-w-[48rem] text-body text-muted" role="status">
        {copy.waiting(waiting)}
      </p>
    )

  // Render logic
  return (
    <form
      onSubmit={handleSubmit}
      className="flex max-w-[48rem] flex-col gap-3 rounded-[var(--radius-card)] bg-surface p-6"
    >
      <h2 className="h4">{copy.title}</h2>
      <p className="text-small text-muted">{copy.help}</p>
      {request?.status === 'declined' ? (
        <p className="text-small text-muted">{copy.declined(request.code)}</p>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="field flex-1">
          <span className="field__label text-small">{copy.label}</span>
          <input
            className="field__input"
            value={code}
            maxLength={24}
            autoCapitalize="none"
            onChange={(e) => setCode(e.target.value)}
          />
        </label>
        <button
          type="submit"
          className={`btn btn--secondary${pending ? ' is-loading' : ''}`}
          disabled={pending || code.trim().length < 3}
        >
          <span className="btn__label">{copy.submit}</span>
        </button>
      </div>
      {error ? (
        <p className="text-small text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  )
}
