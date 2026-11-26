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
import { useState, useTransition } from 'react'
import { affiliatePortalContent } from '@/data/affiliate-portal'
import { requestCodeAction, verifyCodeAction } from '@/lib/account-actions'

type EmailSignInProps = {
  /** Where to land once signed in: the portal's own path. */
  returnTo: string
}

const copy = affiliatePortalContent.signIn

/**
 * Sign in with a 6-digit code to the account's email, through the store's own sign-in actions,
 * so the session starts on this host (the portal's own domain keeps its own cookie).
 */
export default function EmailSignIn({ returnTo }: EmailSignInProps) {
  // Hooks
  const [pending, start] = useTransition()
  const [email, setEmail] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Event handlers
  const handleSend = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    start(async () => {
      const r = await requestCodeAction(email)
      if (r.ok) setSentTo(r.email ?? email)
      else setError(r.error ?? copy.error)
    })
  }
  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault()
    if (!sentTo) return
    setError(null)
    start(async () => {
      // Redirects on success; only a failure comes back.
      const r = await verifyCodeAction(sentTo, code, returnTo)
      if (r?.error) setError(r.error)
    })
  }
  const handleOther = () => {
    setSentTo(null)
    setCode('')
    setError(null)
  }

  // Early returns
  if (sentTo)
    return (
      <form onSubmit={handleVerify}>
        <FieldGroup>
          <Field data-invalid={error ? true : undefined}>
            <FieldLabel htmlFor="portal-code">{copy.code}</FieldLabel>
            <Input
              id="portal-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              pattern="[0-9]*"
              required
              autoFocus
              className="font-mono tracking-[0.5em]"
              value={code}
              aria-invalid={error ? true : undefined}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            />
            <FieldDescription>{copy.codeHint(sentTo)}</FieldDescription>
            {error ? <FieldError>{error}</FieldError> : null}
          </Field>
          <Button type="submit" className="w-full" loading={pending} disabled={code.length < 6}>
            {pending ? copy.verifying : copy.verify}
          </Button>
          <Button type="button" variant="link" onClick={handleOther}>
            {copy.otherEmail}
          </Button>
        </FieldGroup>
      </form>
    )

  // Render logic
  return (
    <form onSubmit={handleSend}>
      <FieldGroup>
        <Field data-invalid={error ? true : undefined}>
          <FieldLabel htmlFor="portal-email">{copy.email}</FieldLabel>
          <Input
            id="portal-email"
            type="email"
            autoComplete="email"
            required
            placeholder={copy.emailPlaceholder}
            value={email}
            aria-invalid={error ? true : undefined}
            onChange={(e) => setEmail(e.target.value)}
          />
          {error ? <FieldError>{error}</FieldError> : null}
        </Field>
        <Button type="submit" className="w-full" loading={pending}>
          {pending ? copy.sending : copy.send}
        </Button>
      </FieldGroup>
    </form>
  )
}
