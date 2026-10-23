'use client'

import { useState, useTransition } from 'react'
import { affiliateContent } from '@/data/affiliate'
import { savePayoutDetailsAction } from '@/lib/affiliate-actions'

type PayoutDetailsFormProps = { hint: string | null }

const copy = affiliateContent.payout

/**
 * UPI ID or bank account, and an optional PAN. What is saved is never shown back, only the
 * masked hint ("UPI as•••@okaxis"); typing again replaces it.
 */
export default function PayoutDetailsForm({ hint }: PayoutDetailsFormProps) {
  // Hooks
  const [pending, start] = useTransition()
  const [method, setMethod] = useState<'upi' | 'bank'>('upi')
  const [upiId, setUpiId] = useState('')
  const [accountName, setAccountName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [ifsc, setIfsc] = useState('')
  const [pan, setPan] = useState('')
  const [error, setError] = useState<{ message: string; field?: string | undefined } | null>(null)
  const [saved, setSaved] = useState(false)

  // Event handlers
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaved(false)
    const panValue = pan.trim() ? pan.trim() : undefined
    const details =
      method === 'upi'
        ? { method, upiId, pan: panValue }
        : { method, accountName, accountNumber, ifsc, pan: panValue }
    start(async () => {
      const r = await savePayoutDetailsAction(details)
      if (r.ok) {
        setSaved(true)
        setUpiId('')
        setAccountNumber('')
        setPan('')
      } else {
        setError({ message: copy.errors[r.error] ?? copy.errors.generic ?? '', field: r.field })
      }
    })
  }

  // Render logic
  const invalid = (field: string) => (error?.field === field ? true : undefined)

  return (
    <form
      onSubmit={handleSubmit}
      className="flex max-w-[36rem] flex-col gap-5 rounded-[var(--radius-card)] bg-surface p-6"
    >
      <h2 className="h3">{copy.title}</h2>
      <p className="text-body text-muted">{hint ? copy.current(hint) : copy.none}</p>
      <div className="flex gap-6" role="radiogroup">
        {(['upi', 'bank'] as const).map((m) => (
          <label key={m} className="flex items-center gap-2 text-body">
            <input
              type="radio"
              name="payout-method"
              className="size-4"
              checked={method === m}
              onChange={() => setMethod(m)}
            />
            {m === 'upi' ? copy.upi : copy.bank}
          </label>
        ))}
      </div>
      {method === 'upi' ? (
        <label className="field">
          <span className="field__label text-small">{copy.upiId}</span>
          <input
            className="field__input"
            autoComplete="off"
            inputMode="email"
            value={upiId}
            aria-invalid={invalid('upiId')}
            onChange={(e) => setUpiId(e.target.value)}
          />
        </label>
      ) : (
        <>
          <label className="field">
            <span className="field__label text-small">{copy.accountName}</span>
            <input
              className="field__input"
              autoComplete="name"
              value={accountName}
              aria-invalid={invalid('accountName')}
              onChange={(e) => setAccountName(e.target.value)}
            />
          </label>
          <label className="field">
            <span className="field__label text-small">{copy.accountNumber}</span>
            <input
              className="field__input"
              autoComplete="off"
              inputMode="numeric"
              value={accountNumber}
              aria-invalid={invalid('accountNumber')}
              onChange={(e) => setAccountNumber(e.target.value)}
            />
          </label>
          <label className="field">
            <span className="field__label text-small">{copy.ifsc}</span>
            <input
              className="field__input uppercase"
              autoComplete="off"
              maxLength={11}
              value={ifsc}
              aria-invalid={invalid('ifsc')}
              onChange={(e) => setIfsc(e.target.value)}
            />
          </label>
        </>
      )}
      <label className="field">
        <span className="field__label text-small">{copy.pan}</span>
        <input
          className="field__input uppercase"
          autoComplete="off"
          maxLength={10}
          value={pan}
          aria-invalid={invalid('pan')}
          onChange={(e) => setPan(e.target.value)}
        />
        <span className="text-small text-muted">{copy.panHint}</span>
      </label>
      {error ? (
        <p className="text-small text-danger" role="alert">
          {error.message}
        </p>
      ) : null}
      <div className="flex items-center gap-4">
        <button
          type="submit"
          className={`btn btn--primary${pending ? ' is-loading' : ''}`}
          disabled={pending}
        >
          <span className="btn__label">{pending ? copy.saving : copy.save}</span>
        </button>
        {saved ? (
          <span className="text-small text-success" role="status">
            {copy.saved}
          </span>
        ) : null}
      </div>
    </form>
  )
}
