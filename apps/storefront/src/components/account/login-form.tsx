'use client'

import type { ReactNode } from 'react'
import { useEffect, useState, useTransition } from 'react'
import AccountCodeStep from '@/components/account/account-code-step'
import AccountSubmit from '@/components/account/account-submit'
import ResendCode from '@/components/account/resend-code'
import CheckoutField from '@/components/checkout/checkout-field'
import CheckoutIcon from '@/components/checkout/checkout-icon'
import { accountContent } from '@/data/account'
import { requestCodeAction, verifyCodeAction } from '@/lib/account-actions'
import { ACCOUNT_LINK, ACCOUNT_TITLE } from '@/lib/account-classes'
import { CK_LIFT } from '@/lib/checkout-classes'
import { requestMagicLinkAction } from '@/lib/login-actions'

type LoginFormProps = {
  /** Same-site path to land on after signing in. */
  returnTo: string
  /** "Remember this device", when the store offers the choice. */
  remember?: boolean
  /** The "Keep me signed in" box, drawn above Verify on the code step. */
  rememberControl?: ReactNode
  /** Offer "Email me a sign-in link instead". */
  magicLink?: boolean
  /** A provider sign-in whose email must be confirmed with a code first. */
  confirmEmail?: string | null
  /** Tells the card which step is on screen, so it hides the quick ways in after the first. */
  onStep?: (later: boolean) => void
}

const copy = accountContent.login
const FIELD_ID = 'login-email'

/** Two steps: email, then the six digit code mailed to it. The card is `SignIn`'s. */
export default function LoginForm({
  returnTo,
  remember = true,
  rememberControl = null,
  magicLink = false,
  confirmEmail = null,
  onStep,
}: LoginFormProps) {
  // Hooks
  const [pending, start] = useTransition()
  const [email, setEmail] = useState(confirmEmail ?? '')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [linkSentTo, setLinkSentTo] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    onStep?.(sentTo !== null || linkSentTo !== null)
  }, [sentTo, linkSentTo, onStep])

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
    if (!sentTo || code.length !== 6) return
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
      <div className={`flex flex-col gap-4 ${CK_LIFT}`} role="status">
        <span className="grid size-11 place-items-center rounded-full bg-ck-accent-soft text-ck-accent-lift">
          <CheckoutIcon name="mail" className="size-5" />
        </span>
        <h1 className={ACCOUNT_TITLE}>{copy.link.title}</h1>
        <p className="text-[0.9375rem] text-ck-muted">{copy.magicLinkSent(linkSentTo)}</p>
        <button type="button" className={`${ACCOUNT_LINK} self-start`} onClick={handleChangeEmail}>
          <CheckoutIcon name="back" className="size-3.5" />
          {copy.changeEmail}
        </button>
      </div>
    )
  }

  // Render logic
  return sentTo ? (
    <AccountCodeStep
      sentLine={copy.codeSent(sentTo)}
      code={code}
      onCode={setCode}
      error={error}
      pending={pending}
      onBack={confirmEmail ? null : handleChangeEmail}
      onSubmit={handleCode}
      extra={rememberControl}
      resend={<ResendCode key={sentTo} disabled={pending} onResend={() => send(sentTo)} />}
    />
  ) : (
    <form onSubmit={handleEmail} className={`flex flex-col gap-4 ${CK_LIFT}`} noValidate>
      <div className="flex flex-col gap-1.5">
        <h1 className={ACCOUNT_TITLE}>{confirmEmail ? copy.confirmTitle : copy.title}</h1>
        <p className="text-[0.9375rem] text-ck-muted">
          {confirmEmail ? copy.confirmIntro(confirmEmail) : copy.intro}
        </p>
      </div>
      <CheckoutField
        id={FIELD_ID}
        label={copy.email}
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder={copy.emailPlaceholder}
        readOnly={Boolean(confirmEmail)}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={error}
      />
      <AccountSubmit label={copy.sendCode} pendingLabel={copy.sending} pending={pending} />
      {magicLink && !confirmEmail ? (
        <button
          type="button"
          className={`${ACCOUNT_LINK} self-center`}
          onClick={handleLink}
          disabled={pending || email.trim().length === 0}
        >
          <CheckoutIcon name="mail" className="size-4" />
          {pending ? copy.magicLinkSending : copy.magicLink}
        </button>
      ) : null}
    </form>
  )
}
