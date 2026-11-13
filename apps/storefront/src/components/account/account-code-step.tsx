'use client'

import type { ReactNode } from 'react'
import { useRef } from 'react'
import AccountError from '@/components/account/account-error'
import AccountSubmit from '@/components/account/account-submit'
import CodeBoxes from '@/components/account/code-boxes'
import CheckoutIcon from '@/components/checkout/checkout-icon'
import { accountContent } from '@/data/account'
import { ACCOUNT_LINK, ACCOUNT_TITLE } from '@/lib/account-classes'
import { CK_LIFT } from '@/lib/checkout-classes'

type AccountCodeStepProps = {
  /** "Sent by SMS to +91 98765 43210." */
  sentLine: string
  code: string
  onCode: (code: string) => void
  error: string | null
  pending: boolean
  /** Back to the number or email; null when the address is fixed (a provider's email to confirm). */
  onBack: (() => void) | null
  /** The resend row: countdown, "Send a new code", "Get it on WhatsApp". */
  resend: ReactNode
  /** Above the button: "Keep me signed in on this device", when the store offers it. */
  extra?: ReactNode
  onSubmit: (e: React.FormEvent) => void
}

const copy = accountContent.login
const ERROR_ID = 'login-code-error'

/**
 * The second step of signing in (Figma 948:15578): Back, "Enter the code", where it went, six
 * boxes, the resend row, then Verify and sign in. The sixth digit sends the form by itself.
 */
export default function AccountCodeStep({
  sentLine,
  code,
  onCode,
  error,
  pending,
  onBack,
  resend,
  extra = null,
  onSubmit,
}: AccountCodeStepProps) {
  // Hooks
  const formRef = useRef<HTMLFormElement>(null)

  // Event handlers
  const handleComplete = () => {
    if (!pending) formRef.current?.requestSubmit()
  }

  // Render logic
  const errorId = error ? ERROR_ID : null

  return (
    <form ref={formRef} onSubmit={onSubmit} className={`flex flex-col gap-4 ${CK_LIFT}`} noValidate>
      {onBack ? (
        <button type="button" className={`${ACCOUNT_LINK} -my-2 self-start`} onClick={onBack}>
          <CheckoutIcon name="back" className="size-3.5" />
          {copy.back}
        </button>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <h1 className={ACCOUNT_TITLE}>{copy.codeTitle}</h1>
        <p className="text-[0.9375rem] text-ck-muted">{sentLine}</p>
      </div>
      <div className="flex flex-col gap-1">
        <CodeBoxes
          id="login-code"
          label={copy.code}
          value={code}
          onChange={onCode}
          onComplete={handleComplete}
          errorId={errorId}
        />
        <AccountError id={ERROR_ID} message={error} />
      </div>
      {resend}
      {extra}
      <AccountSubmit
        label={copy.verify}
        pendingLabel={copy.verifying}
        pending={pending}
        disabled={code.length !== 6}
      />
    </form>
  )
}
