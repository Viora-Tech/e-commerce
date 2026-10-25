'use client'

import { useState, useTransition } from 'react'
import { privacyContent } from '@/data/privacy'
import { confirmDeletionAction, requestDeletionCodeAction } from '@/lib/privacy-actions'

type Step = 'intro' | 'explain' | 'code'

const copy = privacyContent.deletion

/**
 * Delete my account, one step at a time: what happens, a code to prove it is
 * really them, then the request goes to the store and they are signed out.
 */
export default function DeleteAccount() {
  // Hooks
  const [pending, start] = useTransition()
  const [step, setStep] = useState<Step>('intro')
  const [hint, setHint] = useState('')
  const [code, setCode] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Helpers
  const sendCode = () => {
    setError(null)
    start(async () => {
      const r = await requestDeletionCodeAction()
      if (!r.ok) {
        setError(r.error ?? copy.errors.noChannel)
        return
      }
      setHint(r.hint ?? '')
      setCode('')
      setStep('code')
    })
  }

  // Event handlers
  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    start(async () => {
      const r = await confirmDeletionAction(code, reason)
      if (r?.error) setError(r.error)
    })
  }

  const handleCancel = () => {
    setStep('intro')
    setError(null)
  }

  // Render logic
  const errorLine = error ? (
    <p className="text-small text-danger" role="alert">
      {error}
    </p>
  ) : null

  return (
    <section className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-surface p-6">
      <h2 className="h3">{copy.heading}</h2>
      {step === 'intro' ? (
        <div>
          <button type="button" className="btn btn--secondary" onClick={() => setStep('explain')}>
            <span className="btn__label">{copy.start}</span>
          </button>
        </div>
      ) : null}
      {step === 'explain' ? (
        <>
          <p className="text-body text-muted">{copy.body}</p>
          {errorLine}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className={`btn btn--primary${pending ? ' is-loading' : ''}`}
              disabled={pending}
              onClick={sendCode}
            >
              <span className="btn__label">{pending ? copy.sending : copy.sendCode}</span>
            </button>
            <button type="button" className="btn btn--secondary" onClick={handleCancel}>
              <span className="btn__label">{copy.cancel}</span>
            </button>
          </div>
        </>
      ) : null}
      {step === 'code' ? (
        <form onSubmit={handleConfirm} className="flex flex-col gap-4">
          <p className="text-body text-muted">{copy.codeSent(hint)}</p>
          <label className="field">
            <span className="field__label text-small">{copy.code}</span>
            <input
              className="field__input text-center tracking-[0.5em]"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            />
          </label>
          <label className="field">
            <span className="field__label text-small">{copy.reason}</span>
            <textarea
              className="field__input"
              rows={3}
              maxLength={2000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          {errorLine}
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              className={`btn btn--primary${pending ? ' is-loading' : ''}`}
              disabled={pending || code.length !== 6}
            >
              <span className="btn__label">{pending ? copy.confirming : copy.confirm}</span>
            </button>
            <button type="button" className="btn btn--secondary" onClick={handleCancel}>
              <span className="btn__label">{copy.cancel}</span>
            </button>
          </div>
        </form>
      ) : null}
    </section>
  )
}
