'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { useRouter } from 'next/navigation'
import { type FormEvent, useState } from 'react'
import { authContent } from '@/data/auth'
import { authClient } from '@/lib/auth-client'

type Step = 'email' | 'otp'

const copy = authContent.login

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState<Step>('email')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSendCode = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const res = await authClient.emailOtp.sendVerificationOtp({ email, type: 'sign-in' })
    setBusy(false)
    if (res.error) return setError(res.error.message ?? copy.sendFailed)
    setStep('otp')
  }

  const handleVerify = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const res = await authClient.signIn.emailOtp({ email, otp })
    setBusy(false)
    if (res.error) return setError(res.error.message ?? copy.wrongCode)
    router.push('/')
    router.refresh()
  }

  return (
    <main className="flex min-h-svh items-start justify-center px-4 pt-[12vh]">
      <Card size="form" className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-page-title text-ink-strong">{copy.title}</CardTitle>
        </CardHeader>
        <CardContent>
          {step === 'email' ? (
            <form onSubmit={handleSendCode}>
              <FieldGroup>
                <Field data-invalid={error ? true : undefined}>
                  <FieldLabel htmlFor="login-email">{copy.email}</FieldLabel>
                  <Input
                    id="login-email"
                    size="lg"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    aria-invalid={error ? true : undefined}
                    autoFocus
                    required
                  />
                  {error ? (
                    <FieldError>{error}</FieldError>
                  ) : (
                    <FieldDescription>{copy.emailHelp}</FieldDescription>
                  )}
                </Field>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? <Spinner /> : null}
                  {copy.continue}
                </Button>
              </FieldGroup>
            </form>
          ) : (
            <form onSubmit={handleVerify}>
              <FieldGroup>
                <Field data-invalid={error ? true : undefined}>
                  <FieldLabel htmlFor="login-otp">{copy.code(email)}</FieldLabel>
                  <Input
                    id="login-otp"
                    size="lg"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    maxLength={6}
                    aria-invalid={error ? true : undefined}
                    autoFocus
                  />
                  {error ? (
                    <FieldError>{error}</FieldError>
                  ) : (
                    <FieldDescription>{copy.codeHelp}</FieldDescription>
                  )}
                </Field>
                <Button type="submit" className="w-full" disabled={busy || otp.length < 6}>
                  {busy ? <Spinner /> : null}
                  {copy.submit}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    setStep('email')
                    setError(null)
                  }}
                >
                  {copy.differentEmail}
                </Button>
              </FieldGroup>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
