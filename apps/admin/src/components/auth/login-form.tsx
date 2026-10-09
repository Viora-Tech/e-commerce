'use client'

import { siteConfig } from '@commerce/config/site'
import { Button } from '@commerce/ui/shadcn/button'
import { Field, FieldError, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { useRouter } from 'next/navigation'
import { type FormEvent, useEffect, useState } from 'react'
import OtpInput from '@/components/auth/otp-input'
import { loginContent } from '@/data/login'
import { useCopy } from '@/hooks/use-copy'
import { authClient } from '@/lib/auth-client'

type Step = 'email' | 'otp'
type Mode = 'sign-in' | 'sign-up'

const RESEND_SECONDS = 30

function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

export default function LoginForm() {
  // Hooks
  const copy = useCopy(loginContent)
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState<Step>('email')
  const [mode, setMode] = useState<Mode>('sign-in')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [wait, setWait] = useState(0)

  useEffect(() => {
    if (wait <= 0) return
    const timer = setTimeout(() => setWait((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [wait])

  // Helpers
  const sendCode = async () => {
    setBusy(true)
    setError(null)
    const res = await authClient.emailOtp.sendVerificationOtp({ email, type: 'sign-in' })
    setBusy(false)
    if (res.error) {
      setError(res.error.message ?? copy.sendFailed)
      return false
    }
    setWait(RESEND_SECONDS)
    return true
  }

  // Event handlers
  const handleSendCode = async (e: FormEvent) => {
    e.preventDefault()
    if (await sendCode()) setStep('otp')
  }

  const handleResend = async () => {
    setOtp('')
    await sendCode()
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

  const handleChangeEmail = () => {
    setStep('email')
    setOtp('')
    setError(null)
  }

  const handleSwitchMode = () => {
    setMode((m) => (m === 'sign-in' ? 'sign-up' : 'sign-in'))
    setError(null)
  }

  // Render logic
  const brand = siteConfig.brand.name
  const head = mode === 'sign-in' ? copy.signIn : copy.signUp
  const body = mode === 'sign-in' ? copy.signIn.body : copy.signUp.body(brand)

  if (step === 'otp') {
    return (
      <div className="flex w-full max-w-sm flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-page-title text-ink-strong">{copy.otp.title}</h1>
          <p className="text-body text-helper">{copy.otp.sentTo(email)}</p>
        </div>
        <form onSubmit={handleVerify} className="flex flex-col gap-4">
          <Field data-invalid={error ? true : undefined}>
            <FieldLabel htmlFor="login-otp">{copy.otp.label}</FieldLabel>
            <OtpInput
              id="login-otp"
              value={otp}
              onChange={setOtp}
              label={copy.otp.label}
              invalid={Boolean(error)}
              disabled={busy}
            />
            {error ? <FieldError>{error}</FieldError> : null}
          </Field>
          <Button
            type="submit"
            size="lg"
            className="w-full"
            loading={busy}
            disabled={otp.length < 6}
          >
            {busy ? copy.otp.verifying : copy.otp.submit}
          </Button>
        </form>
        <div className="flex items-center justify-between text-body">
          {wait > 0 ? (
            <span className="text-helper tabular-nums">{copy.otp.resendIn(clock(wait))}</span>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              disabled={busy}
              className="font-medium text-primary hover:underline"
            >
              {copy.otp.resend}
            </button>
          )}
          <button type="button" onClick={handleChangeEmail} className="text-helper hover:underline">
            {copy.otp.differentEmail}
          </button>
        </div>
        <p className="text-caption text-helper">{copy.otp.devHint}</p>
      </div>
    )
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-page-title text-ink-strong">{head.title}</h1>
        <p className="text-body text-helper">{body}</p>
      </div>
      <form onSubmit={handleSendCode} className="flex flex-col gap-4">
        <Field data-invalid={error ? true : undefined}>
          <FieldLabel htmlFor="login-email">{copy.email}</FieldLabel>
          <Input
            id="login-email"
            size="lg"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={copy.emailPlaceholder}
            autoComplete="email"
            aria-invalid={error ? true : undefined}
            autoFocus
            required
          />
          {error ? <FieldError>{error}</FieldError> : null}
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          {busy ? copy.sending : head.submit}
        </Button>
      </form>
      <p className="text-body text-helper">
        {mode === 'sign-in' ? copy.newHere(brand) : copy.signUp.haveAccount}{' '}
        <button
          type="button"
          onClick={handleSwitchMode}
          className="font-medium text-primary hover:underline"
        >
          {mode === 'sign-in' ? copy.createStore : copy.signUp.signInLink}
        </button>
      </p>
      <p className="text-caption text-helper">
        {copy.terms.prefix}{' '}
        <a href={siteConfig.urls.terms} target="_blank" rel="noreferrer" className="underline">
          {copy.terms.terms}
        </a>{' '}
        {copy.terms.and}{' '}
        <a href={siteConfig.urls.privacy} target="_blank" rel="noreferrer" className="underline">
          {copy.terms.privacy}
        </a>
        .
      </p>
    </div>
  )
}
