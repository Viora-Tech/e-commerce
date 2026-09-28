'use client'

import type { ReactNode } from 'react'
import { useState, useTransition } from 'react'
import { accountContent } from '@/data/account'
import { requestCodeAction, verifyCodeAction } from '@/lib/account-actions'
import { requestMagicLinkAction } from '@/lib/login-actions'

type LoginFormProps = {
  /** Same-site path to land on after signing in. */
  returnTo: string
  /** Under the button: guest checkout allowed, or an account needed. */
  note: string
  /** A link to switch to mobile sign-in, when the store offers it too. */
  alternative?: ReactNode
  /** "Remember this device", when the store offers the choice. */
  remember?: boolean
  /** Offer "Email me a sign-in link instead". */
  magicLink?: boolean
  /** A provider sign-in whose email must be confirmed with a code first. */
  confirmEmail?: string | null
}

const copy = accountContent.login

/** Two steps: email, then the six digit code mailed to it. The card is `SignIn`'s. */
export default function LoginForm({
  returnTo,
  note,
  alternative,
  remember = true,
  magicLink = false,
  confirmEmail = null,
}: LoginFormProps) {
  // Hooks
  const [pending, start] = useTransition()
  const [email, setEmail] = useState(confirmEmail ?? '')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [linkSentTo, setLinkSentTo] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Helpers
  const send = (address: string) => {
    setError(null)
    start(async () => {
      const r = await requestCodeAction(address)
      if (!r.ok) {
        setError(r.error ?? copy.errors.invalidEmail)
        return
      }
      setSentTo(r.email ?? address)
      setCode('')
    })
  }

  // Event handlers
  const handleEmail = (e: React.FormEvent) => {
    e.preventDefault()
    send(email)
  }

  const handleLink = () => {
    setError(null)
    start(async () => {
      const r = await requestMagicLinkAction(email, returnTo, remember)
      if (!r.ok) {
        setError(r.error ?? copy.errors.invalidEmail)
        return
      }
      setLinkSentTo(email.trim())
    })
  }

  const handleCode = (e: React.FormEvent) => {
    e.preventDefault()
    if (!sentTo) return
    setError(null)
    start(async () => {
      const r = await verifyCodeAction(sentTo, code, returnTo, remember)
      if (r?.error) setError(r.error)
    })
  }

  const handleChangeEmail = () => {
    setSentTo(null)
    setLinkSentTo(null)
    setError(null)
  }

  // Early returns
  if (linkSentTo) {
    return (
      <div className="flex flex-col gap-5" role="status">
        <h1 className="h3">{copy.link.title}</h1>
        <p className="text-body text-muted">{copy.magicLinkSent(linkSentTo)}</p>
        <button
          type="button"
          className="text-small underline underline-offset-4 text-left"
          onClick={handleChangeEmail}
        >
          {copy.changeEmail}
        </button>
      </div>
    )
  }

  // Render logic
  const errorLine = error ? (
    <p className="text-small text-danger" role="alert">
      {error}
    </p>
  ) : null

  return (
    <>
      {sentTo ? (
        <form onSubmit={handleCode} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <h1 className="h3">{copy.codeTitle}</h1>
            <p className="text-body text-muted">{copy.codeSent(sentTo)}</p>
          </div>
          <label className="field">
            <span className="field__label text-small">{copy.code}</span>
            <input
              className="field__input text-center tracking-[0.5em]"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              // biome-ignore lint/a11y/noAutofocus: the only field on this step, reached by the shopper's own submit.
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            />
          </label>
          {errorLine}
          <button
            type="submit"
            className={`btn btn--primary w-full${pending ? ' is-loading' : ''}`}
            disabled={pending || code.length !== 6}
          >
            <span className="btn__label">{pending ? copy.verifying : copy.verify}</span>
          </button>
          <div className="flex flex-wrap justify-between gap-3 text-small">
            <button
              type="button"
              className="underline underline-offset-4 disabled:opacity-50"
              onClick={() => send(sentTo)}
              disabled={pending}
            >
              {copy.resend}
            </button>
            {confirmEmail ? null : (
              <button
                type="button"
                className="underline underline-offset-4 disabled:opacity-50"
                onClick={handleChangeEmail}
              >
                {copy.changeEmail}
              </button>
            )}
          </div>
        </form>
      ) : (
        <form onSubmit={handleEmail} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <h1 className="h3">{confirmEmail ? copy.confirmTitle : copy.title}</h1>
            <p className="text-body text-muted">
              {confirmEmail ? copy.confirmIntro(confirmEmail) : copy.intro}
            </p>
          </div>
          <label className="field">
            <span className="field__label text-small">{copy.email}</span>
            <input
              className="field__input"
              type="email"
              name="email"
              autoComplete="email"
              required
              readOnly={Boolean(confirmEmail)}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          {errorLine}
          <button
            type="submit"
            className={`btn btn--primary w-full${pending ? ' is-loading' : ''}`}
            disabled={pending}
          >
            <span className="btn__label">{pending ? copy.sending : copy.sendCode}</span>
          </button>
          {magicLink && !confirmEmail ? (
            <button
              type="button"
              className="text-small underline underline-offset-4 disabled:opacity-50"
              onClick={handleLink}
              disabled={pending || email.trim().length === 0}
            >
              {pending ? copy.magicLinkSending : copy.magicLink}
            </button>
          ) : null}
          {confirmEmail ? null : alternative}
          <p className="text-small text-muted">{note}</p>
        </form>
      )}
    </>
  )
}
