'use client'

import { Field, FieldError, FieldLabel } from '@commerce/ui/shadcn/field'
import { startAuthentication } from '@simplewebauthn/browser'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import OtpInput from '@/components/auth/otp-input'
import FormDialog from '@/components/layout/form-dialog'
import { stepUpContent } from '@/data/step-up'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { setStepUpOpener } from '@/lib/step-up-gate'

type StepUpProviderProps = {
  children: ReactNode
}

/** 'loading' while the server says which factor to offer, then the chosen factor. */
type Phase = 'loading' | 'passkey' | 'otp'

const RESEND_SECONDS = 30

function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

/** WebAuthn is a browser feature; a browser without it only ever sees the code path. */
const browserSupportsPasskeys = () =>
  typeof window !== 'undefined' && typeof window.PublicKeyCredential === 'function'

/**
 * Mounts once near the app root and drives step-up re-authentication (A5). The api-client
 * interceptor, on a `STEP_UP_REQUIRED` refusal, calls `requestStepUp()`, which opens this dialog;
 * once the member re-verifies with a passkey or an emailed code (stamping the SAME session's
 * `reauthenticated_at`, no new session), the blocked call is retried transparently. The popup is
 * the shared `FormDialog` so it stays symmetric with every other admin dialog.
 */
export default function StepUpProvider({ children }: StepUpProviderProps) {
  // Hooks
  const copy = useCopy(stepUpContent)
  const resolveRef = useRef<((ok: boolean) => void) | null>(null)
  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState<Phase>('loading')
  const [otp, setOtp] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [wait, setWait] = useState(0)

  useEffect(() => {
    if (wait <= 0) return
    const timer = setTimeout(() => setWait((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [wait])

  useEffect(() => {
    // How the (non-React) interceptor opens this dialog. Self-contained so it needs no handler
    // defined below; the dialog lives for the app's lifetime, so this registers once.
    setStepUpOpener(
      () =>
        new Promise<boolean>((resolve) => {
          resolveRef.current = resolve
          setOtp('')
          setError(null)
          setWait(0)
          setBusy(true)
          setPhase('loading')
          setOpen(true)
          api.reauth
            .status()
            .then(async (status) => {
              // Another tab may have re-verified while this call was in flight.
              if (status.fresh) {
                resolveRef.current?.(true)
                resolveRef.current = null
                setOpen(false)
                return
              }
              if (status.method === 'passkey' && browserSupportsPasskeys()) {
                setPhase('passkey')
                setBusy(false)
                return
              }
              setPhase('otp')
              try {
                await api.reauth.sendOtp()
                setWait(RESEND_SECONDS)
              } catch {
                setError(copy.otp.sendFailed)
              } finally {
                setBusy(false)
              }
            })
            .catch(() => {
              setPhase('otp')
              setBusy(false)
            })
        }),
    )
    return () => setStepUpOpener(null)
  }, [copy.otp.sendFailed])

  // Event handlers
  const finish = (ok: boolean) => {
    resolveRef.current?.(ok)
    resolveRef.current = null
    setOpen(false)
  }

  const sendCode = async () => {
    setBusy(true)
    setError(null)
    try {
      await api.reauth.sendOtp()
      setWait(RESEND_SECONDS)
    } catch {
      setError(copy.otp.sendFailed)
    } finally {
      setBusy(false)
    }
  }

  const handleResend = async () => {
    setOtp('')
    await sendCode()
  }

  const handleUseCode = () => {
    setPhase('otp')
    setError(null)
    void sendCode()
  }

  const handleVerifyOtp = async (code: string) => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await api.reauth.verify({ otp: code })
      finish(true)
    } catch {
      setError(copy.otp.wrong)
      setBusy(false)
    }
  }

  const handlePasskey = async () => {
    setBusy(true)
    setError(null)
    try {
      const optionsJSON = await api.reauth.passkeyOptions()
      const response = await startAuthentication({ optionsJSON })
      await api.reauth.verify({ passkeyResponse: response })
      finish(true)
    } catch {
      // Includes the member dismissing the browser's own prompt; let them retry or use a code.
      setError(copy.passkey.failed)
      setBusy(false)
    }
  }

  const handleSubmit = () => {
    if (phase === 'passkey') {
      void handlePasskey()
      return
    }
    if (phase === 'otp') void handleVerifyOtp(otp)
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) finish(false)
  }

  // Render logic
  const submitLabel = phase === 'passkey' ? copy.passkey.button : copy.otp.submit
  const submitDisabled = phase === 'loading' || (phase === 'otp' && otp.length < 6)
  return (
    <>
      {children}
      <FormDialog
        open={open}
        onOpenChange={handleOpenChange}
        title={copy.title}
        description={copy.body}
        submitLabel={submitLabel}
        busy={busy}
        submitDisabled={submitDisabled}
        onSubmit={handleSubmit}
        size="md"
        secondaryAction={
          phase === 'passkey' ? (
            <button
              type="button"
              onClick={handleUseCode}
              disabled={busy}
              className="text-body font-medium text-primary hover:underline"
            >
              {copy.passkey.useCode}
            </button>
          ) : undefined
        }
      >
        {phase === 'loading' ? (
          <p className="text-body text-helper">{copy.loading}</p>
        ) : phase === 'passkey' ? (
          <div className="flex flex-col gap-3">
            <p className="text-body text-helper">{copy.passkey.hint}</p>
            {error ? <p className="text-caption text-destructive">{error}</p> : null}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-body text-helper">{copy.otp.body}</p>
            <Field data-invalid={error ? true : undefined}>
              <FieldLabel htmlFor="step-up-otp">{copy.otp.label}</FieldLabel>
              <OtpInput
                id="step-up-otp"
                value={otp}
                onChange={setOtp}
                onComplete={handleVerifyOtp}
                label={copy.otp.label}
                invalid={Boolean(error)}
                disabled={busy}
              />
              {error ? <FieldError>{error}</FieldError> : null}
            </Field>
            <div className="flex items-center gap-4 text-body">
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
            </div>
            <p className="text-caption text-helper">{copy.otp.devHint}</p>
          </div>
        )}
      </FormDialog>
    </>
  )
}
