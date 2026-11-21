'use client'

import { useState, useTransition } from 'react'
import CheckoutIcon from '@/components/checkout/checkout-icon'
import { privacyContent } from '@/data/privacy'
import {
  ACCOUNT_CARD,
  ACCOUNT_CARD_TITLE,
  ACCOUNT_ERROR,
  ACCOUNT_INTRO,
} from '@/lib/account-classes'
import {
  CK_BUTTON_PRIMARY,
  CK_BUTTON_SECONDARY,
  CK_INPUT,
  CK_INPUT_HEIGHT,
  CK_LABEL,
} from '@/lib/checkout-classes'
import { confirmDeletionAction, requestDeletionCodeAction } from '@/lib/privacy-actions'

type Step = 'intro' | 'explain' | 'code'

const copy = privacyContent.deletion

/* The danger versions swap the colour classes rather than stacking a second `!` over them. */
const START = CK_BUTTON_SECONDARY.replace('text-ck-ink!', 'text-ck-danger!')
const DANGER = CK_BUTTON_PRIMARY.replace('bg-ck-button!', 'bg-ck-danger!').replace(
  'text-ck-button-ink!',
  'text-white!',
)

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
    <p className={ACCOUNT_ERROR} role="alert">
      <CheckoutIcon name="alert" className="mt-px size-3.5 shrink-0" />
      {error}
    </p>
  ) : null
  const cancel = (
    <button
      type="button"
      className={`${CK_BUTTON_SECONDARY} h-13! w-full sm:w-auto`}
      onClick={handleCancel}
      disabled={pending}
    >
      {copy.cancel}
    </button>
  )

  return (
    <section className={`${ACCOUNT_CARD} gap-3!`} aria-labelledby="delete-account">
      <h2 id="delete-account" className={ACCOUNT_CARD_TITLE}>
        {copy.heading}
      </h2>
      {step === 'intro' ? (
        <div>
          <button
            type="button"
            className={`${START} w-full sm:w-auto`}
            onClick={() => setStep('explain')}
          >
            <CheckoutIcon name="trash" className="size-4" />
            {copy.start}
          </button>
        </div>
      ) : null}
      {step === 'explain' ? (
        <>
          <p className={ACCOUNT_INTRO}>{copy.body}</p>
          {errorLine}
          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            {cancel}
            <button
              type="button"
              className={`${DANGER} sm:w-auto`}
              disabled={pending}
              aria-busy={pending || undefined}
              onClick={sendCode}
            >
              {pending ? (
                <CheckoutIcon
                  name="spinner"
                  className="size-4 animate-spin motion-reduce:animate-none"
                />
              ) : null}
              {pending ? copy.sending : copy.sendCode}
            </button>
          </div>
        </>
      ) : null}
      {step === 'code' ? (
        <form onSubmit={handleConfirm} className="flex flex-col gap-4">
          <p className={ACCOUNT_INTRO}>{copy.codeSent(hint)}</p>
          <div className="flex flex-col gap-2">
            <label htmlFor="delete-code" className={CK_LABEL}>
              {copy.code}
            </label>
            <input
              id="delete-code"
              className={`${CK_INPUT} ${CK_INPUT_HEIGHT} max-w-[14rem] text-center tracking-[0.5em] tabular-nums`}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="delete-reason" className={CK_LABEL}>
              {copy.reason}
            </label>
            <textarea
              id="delete-reason"
              className={`${CK_INPUT} min-h-24 py-3`}
              rows={3}
              maxLength={2000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          {errorLine}
          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            {cancel}
            <button
              type="submit"
              className={`${DANGER} sm:w-auto`}
              disabled={pending || code.length !== 6}
              aria-busy={pending || undefined}
            >
              {pending ? (
                <CheckoutIcon
                  name="spinner"
                  className="size-4 animate-spin motion-reduce:animate-none"
                />
              ) : null}
              {pending ? copy.confirming : copy.confirm}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  )
}
