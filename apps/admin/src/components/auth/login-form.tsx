'use client'

import { siteConfig } from '@commerce/config/site'
import { Button } from '@commerce/ui/shadcn/button'
import { Field, FieldError, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { useRouter } from 'next/navigation'
import { type FormEvent, useEffect, useState } from 'react'
import GoogleSignIn from '@/components/auth/google-sign-in'
import OtpInput from '@/components/auth/otp-input'
import PasskeySignIn from '@/components/auth/passkey-sign-in'
import { loginContent } from '@/data/login'
import { useCopy } from '@/hooks/use-copy'
import { authClient, goAfterSignIn } from '@/lib/auth-client'
import { routes } from '@/lib/routes'

type LoginFormProps = {
  /** The admin has a Google client (MERCHANT_GOOGLE_*): show "Continue with Google". */
  google: boolean
  /** `?error=` from a refused Google sign-in. */
  googleError: string | null
  /** The app-store reviewer's password sign-in is on (REVIEWER_LOGIN_*): show its link. */
  password: boolean
  /** Where to go after signing in; the admin home when null. */
  next: string | null
}

type Step = 'email' | 'otp' | 'password'
type Mode = 'sign-in' | 'sign-up'

const RESEND_SECONDS = 30

function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

export default function LoginForm({ google, googleError, password, next }: LoginFormProps) {
  // Hooks
  const copy = useCopy(loginContent)
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [secret, setSecret] = useState('')
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
    await handleCodeComplete(otp)
  }

  /** The sixth digit verifies straight away; the button is there for a retry. */
  const handleCodeComplete = async (code: string) => {
    if (busy) return
    setBusy(true)
    setError(null)
    const res = await authClient.signIn.emailOtp({ email, otp: code })
    setBusy(false)
    if (res.error) return setError(res.error.message ?? copy.wrongCode)
    goAfterSignIn(router, next, routes.home())
  }

  const handlePasswordSignIn = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const res = await authClient.$fetch('/sign-in/reviewer-password', {
      method: 'POST',
      body: { email, password: secret },
    })
    setBusy(false)
    if (res.error) return setError(copy.password.failed)
    goAfterSignIn(router, next, routes.home())
  }

  const handleShowPassword = () => {
    setStep('password')
    setMode('sign-in')
    setError(null)
  }

  const handleChangeEmail = () => {
    setStep('email')
    setOtp('')
    setSecret('')
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

  if (step === 'password') {
    return (
      <div className="flex w-full max-w-sm flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-page-title text-ink-strong">{copy.password.title}</h1>
          <p className="text-body text-helper">{copy.password.body}</p>
        </div>
        <form onSubmit={handlePasswordSignIn} className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="login-email">{copy.email}</FieldLabel>
            <Input
              id="login-email"
              size="lg"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={copy.emailPlaceholder}
              autoComplete="username"
              autoFocus
              required
            />
          </Field>
          <Field data-invalid={error ? true : undefined}>
            <FieldLabel htmlFor="login-password">{copy.password.label}</FieldLabel>
            <Input
              id="login-password"
              size="lg"
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              autoComplete="current-password"
              aria-invalid={error ? true : undefined}
              required
            />
            {error ? <FieldError>{error}</FieldError> : null}
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={busy}>
            {busy ? copy.password.signingIn : copy.password.submit}
          </Button>
        </form>
        <button
          type="button"
          onClick={handleChangeEmail}
          className="self-start text-body font-medium text-primary hover:underline"
        >
          {copy.password.back}
        </button>
      </div>
    )
  }

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
              onComplete={handleCodeComplete}
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
      {google ? <GoogleSignIn errorCode={googleError} next={next} /> : null}
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
      {mode === 'sign-in' ? <PasskeySignIn next={next} /> : null}
      {password && mode === 'sign-in' ? (
        <button
          type="button"
          onClick={handleShowPassword}
          className="self-start text-body text-helper hover:underline"
        >
          {copy.password.link}
        </button>
      ) : null}
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
