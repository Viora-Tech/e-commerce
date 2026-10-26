'use client'

import { PROMOTE_CHANNELS, type SignupField } from '@commerce/plugin-affiliates/settings'
import { useState, useTransition } from 'react'
import { affiliateContent } from '@/data/affiliate'
import { applyAffiliateAction } from '@/lib/affiliate-actions'
import SignupFields from './signup-fields'

type AffiliateApplyFormProps = {
  defaultName: string
  /** The account's email, where the answer is sent. */
  email: string | null
  terms: string
  /** `?program=` slug of the program applied to; none is the default program. */
  program?: string | undefined
  /** The program's own signup questions. */
  fields?: SignupField[] | undefined
}

const copy = affiliateContent.apply

/**
 * The short application: name, where they post and how they will share, the program's own
 * questions, an optional UPI ID and the terms. The shopper's account supplies email and phone.
 */
export default function AffiliateApplyForm({
  defaultName,
  email,
  terms,
  program,
  fields = [],
}: AffiliateApplyFormProps) {
  // Hooks
  const [pending, start] = useTransition()
  const [name, setName] = useState(defaultName)
  const [social, setSocial] = useState('')
  const [channels, setChannels] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [upiId, setUpiId] = useState('')
  const [accept, setAccept] = useState(false)
  const [answers, setAnswers] = useState<Record<string, string | boolean>>({})
  const [error, setError] = useState<string | null>(null)

  // Event handlers
  const handleChannel = (channel: string, on: boolean) =>
    setChannels((c) => (on ? [...c, channel] : c.filter((x) => x !== channel)))
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const upi = upiId.trim()
    start(async () => {
      const r = await applyAffiliateAction({
        name,
        social,
        message,
        acceptTerms: accept,
        program,
        answers,
        channels,
        payout: upi ? { method: 'upi', upiId: upi } : undefined,
      })
      if (!r.ok) setError(copy.errors[r.error] ?? copy.errors.generic ?? '')
    })
  }

  // Render logic
  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-5 rounded-[var(--radius-card)] bg-surface p-5 sm:p-6"
    >
      <div className="flex flex-col gap-1">
        <h2 className="h3">{copy.title}</h2>
        <p className="text-small text-muted">{email ? copy.as(email) : copy.lead}</p>
      </div>
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
          autoCapitalize="none"
          value={social}
          onChange={(e) => setSocial(e.target.value)}
        />
        <span className="text-small text-muted">{copy.socialHint}</span>
      </label>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-small">{copy.channels}</legend>
        <div className="flex flex-wrap gap-2">
          {PROMOTE_CHANNELS.map((c) => {
            const on = channels.includes(c)
            return (
              <label
                key={c}
                className={`flex! cursor-pointer touch-manipulation items-center rounded-full border px-3 py-1.5 text-small transition-[background-color,color,border-color] duration-(--duration-press) ease-out has-focus-visible:ring-2 has-focus-visible:ring-ink ${
                  on ? 'border-ink bg-ink! text-bg!' : 'border-line'
                }`}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={on}
                  onChange={(e) => handleChannel(c, e.target.checked)}
                />
                {copy.channel[c] ?? c}
              </label>
            )
          })}
        </div>
      </fieldset>
      <label className="field">
        <span className="field__label text-small">{copy.message}</span>
        <textarea
          className="field__input min-h-[5rem]"
          maxLength={2000}
          placeholder={copy.messageHint}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </label>
      <SignupFields
        fields={fields}
        values={answers}
        onChange={(id, value) => setAnswers((a) => ({ ...a, [id]: value }))}
      />
      <label className="field">
        <span className="field__label text-small">{copy.payoutTitle}</span>
        <input
          className="field__input"
          autoComplete="off"
          autoCapitalize="none"
          inputMode="email"
          maxLength={100}
          placeholder={copy.upiPlaceholder}
          aria-label={copy.upiId}
          aria-invalid={error === copy.errors.payout ? true : undefined}
          value={upiId}
          onChange={(e) => setUpiId(e.target.value)}
        />
        <span className="text-small text-muted">{copy.payoutHint}</span>
      </label>
      {terms ? (
        <details className="text-small">
          <summary className="cursor-pointer">{copy.termsTitle}</summary>
          <p className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap text-muted">{terms}</p>
        </details>
      ) : null}
      <label className="flex items-start gap-3 text-body">
        <input
          type="checkbox"
          className="mt-1 size-4 shrink-0"
          required
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
      <button
        type="submit"
        className={`btn btn--primary w-full${pending ? ' is-loading' : ''}`}
        disabled={pending}
      >
        <span className="btn__label">{pending ? copy.sending : copy.submit}</span>
      </button>
    </form>
  )
}
