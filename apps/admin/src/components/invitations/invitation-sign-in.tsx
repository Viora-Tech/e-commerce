'use client'

import { Button } from '@commerce/ui/shadcn/button'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { type FormEvent, useState } from 'react'
import { invitationContent } from '@/data/invitations'
import { authClient } from '@/lib/auth-client'

type InvitationSignInProps = {
  /** The invited address; locked so the session always matches the invitation. */
  email: string
  /** Runs once the invitee is signed in. */
  onSignedIn: () => Promise<void>
}

const copy = invitationContent

/** Email code sign-in for the invited address, then hands over to accept. */
export default function InvitationSignIn({ email, onSignedIn }: InvitationSignInProps) {
  // Hooks
  const [otp, setOtp] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Event handlers
  const handleSend = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const res = await authClient.emailOtp.sendVerificationOtp({ email, type: 'sign-in' })
    setBusy(false)
    if (res.error) return setError(res.error.message ?? copy.sendFailed)
    setSent(true)
  }

  const handleVerify = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const res = await authClient.signIn.emailOtp({ email, otp })
    if (res.error) {
      setBusy(false)
      return setError(res.error.message ?? copy.wrongCode)
    }
    try {
      await onSignedIn()
    } catch (err) {
      setBusy(false)
      setError(err instanceof Error ? err.message : copy.acceptFailed)
    }
  }

  const handleOtpChange = (value: string) => setOtp(value.replace(/\D/g, ''))

  // Render logic
  const invalid = error ? true : undefined

  return (
    <form onSubmit={sent ? handleVerify : handleSend}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="invite-email">{copy.email}</FieldLabel>
          <Input id="invite-email" size="lg" type="email" value={email} readOnly disabled />
          <FieldDescription>{copy.emailLocked}</FieldDescription>
        </Field>
        {sent ? (
          <Field data-invalid={invalid}>
            <FieldLabel htmlFor="invite-otp">{copy.code(email)}</FieldLabel>
            <Input
              id="invite-otp"
              size="lg"
              value={otp}
              onChange={(e) => handleOtpChange(e.target.value)}
              autoComplete="one-time-code"
              inputMode="numeric"
              maxLength={6}
              aria-invalid={invalid}
              autoFocus
            />
            {error ? (
              <FieldError>{error}</FieldError>
            ) : (
              <FieldDescription>{copy.codeHelp}</FieldDescription>
            )}
          </Field>
        ) : error ? (
          <FieldError>{error}</FieldError>
        ) : null}
        <Button type="submit" className="w-full" disabled={busy || (sent && otp.length < 6)}>
          {busy ? <Spinner /> : null}
          {sent ? copy.signInAndAccept : copy.sendCode}
        </Button>
      </FieldGroup>
    </form>
  )
}
