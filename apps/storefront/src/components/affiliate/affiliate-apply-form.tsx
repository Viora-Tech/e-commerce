'use client'

import type { SignupField } from '@commerce/plugin-affiliates/settings'
import { useState, useTransition } from 'react'
import { affiliateContent } from '@/data/affiliate'
import { applyAffiliateAction } from '@/lib/affiliate-actions'
import SignupFields from './signup-fields'

type AffiliateApplyFormProps = {
  defaultName: string
  terms: string
  /** `?program=` slug of the program applied to; none is the default program. */
  program?: string | undefined
  /** The program's own signup questions. */
  fields?: SignupField[] | undefined
}

const copy = affiliateContent.apply

/** Name, where they post and a few words; the shopper's account supplies the email and phone. */
export default function AffiliateApplyForm({
  defaultName,
  terms,
  program,
  fields = [],
}: AffiliateApplyFormProps) {
  // Hooks
  const [pending, start] = useTransition()
  const [name, setName] = useState(defaultName)
  const [social, setSocial] = useState('')
  const [message, setMessage] = useState('')
  const [accept, setAccept] = useState(false)
  const [answers, setAnswers] = useState<Record<string, string | boolean>>({})
  const [error, setError] = useState<string | null>(null)

  // Event handlers
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    start(async () => {
      const r = await applyAffiliateAction({
        name,
        social,
        message,
        acceptTerms: accept,
        program,
        answers,
      })
      if (!r.ok) setError(copy.errors[r.error] ?? copy.errors.generic ?? '')
    })
  }

  // Render logic
  return (
    <form
      onSubmit={handleSubmit}
      className="flex max-w-[36rem] flex-col gap-5 rounded-[var(--radius-card)] bg-surface p-6"
    >
      <h2 className="h3">{copy.title}</h2>
      <label className="field">
        <span className="field__label text-small">{copy.name}</span>
        <input
          className="field__input"
          autoComplete="name"
          required
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label className="field">
        <span className="field__label text-small">{copy.social}</span>
        <input
          className="field__input"
          maxLength={200}
          value={social}
          onChange={(e) => setSocial(e.target.value)}
        />
        <span className="text-small text-muted">{copy.socialHint}</span>
      </label>
      <label className="field">
        <span className="field__label text-small">{copy.message}</span>
        <textarea
          className="field__input min-h-[6rem]"
          maxLength={2000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </label>
      <SignupFields
        fields={fields}
        values={answers}
        onChange={(id, value) => setAnswers((a) => ({ ...a, [id]: value }))}
      />
      {terms ? (
        <details className="text-small">
          <summary className="cursor-pointer">{copy.termsTitle}</summary>
          <p className="mt-2 whitespace-pre-wrap text-muted">{terms}</p>
        </details>
      ) : null}
      <label className="flex items-center gap-3 text-body">
        <input
          type="checkbox"
          className="size-4"
          checked={accept}
          onChange={(e) => setAccept(e.target.checked)}
        />
        {copy.terms}
      </label>
      {error ? (
        <p className="text-small text-danger" role="alert">
          {error}
        </p>
      ) : null}
      <div>
        <button
          type="submit"
          className={`btn btn--primary${pending ? ' is-loading' : ''}`}
          disabled={pending}
        >
          <span className="btn__label">{pending ? copy.sending : copy.submit}</span>
        </button>
      </div>
    </form>
  )
}
