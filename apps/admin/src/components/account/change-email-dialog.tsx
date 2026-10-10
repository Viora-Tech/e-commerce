'use client'

import { Button } from '@commerce/ui/shadcn/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@commerce/ui/shadcn/dialog'
import { Field, FieldError, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { type FormEvent, useState } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'
import OtpInput from '@/components/auth/otp-input'
import { accountContent } from '@/data/account'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type ChangeEmailDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called with the new address once it is the sign-in email. */
  onChanged: (email: string) => void
}

type Step = 'email' | 'code'

const isEmail = (value: string) => z.email().safeParse(value.trim()).success

/**
 * Change the sign-in email in two steps: the new address gets a 6-digit code, the code switches
 * the email over. The old address is told by the server, not here.
 */
export default function ChangeEmailDialog({
  open,
  onOpenChange,
  onChanged,
}: ChangeEmailDialogProps) {
  // Hooks
  const {
    security: { changeEmail: copy },
  } = useCopy(accountContent)
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Helpers
  const reset = () => {
    setStep('email')
    setEmail('')
    setOtp('')
    setError(null)
  }

  // Event handlers
  const handleOpenChange = (next: boolean) => {
    if (busy) return
    if (!next) reset()
    onOpenChange(next)
  }

  const handleSend = async (e: FormEvent) => {
    e.preventDefault()
    if (!isEmail(email)) {
      setError(copy.invalidEmail)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const { sentTo } = await api.account.requestEmailChange({ newEmail: email.trim() })
      setEmail(sentTo)
      setStep('code')
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  const handleConfirm = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const result = await api.account.confirmEmailChange({ newEmail: email, otp })
      toast.success(copy.done(result.email))
      reset()
      onChanged(result.email)
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  const handleBack = () => {
    setStep('email')
    setOtp('')
    setError(null)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        {step === 'email' ? (
          <form onSubmit={handleSend} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>{copy.title}</DialogTitle>
              <DialogDescription>{copy.body}</DialogDescription>
            </DialogHeader>
            <Field data-invalid={error ? true : undefined}>
              <FieldLabel htmlFor="new-email">{copy.newEmail}</FieldLabel>
              <Input
                id="new-email"
                size="lg"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={copy.placeholder}
                autoComplete="email"
                aria-invalid={error ? true : undefined}
                disabled={busy}
                autoFocus
              />
              {error ? <FieldError>{error}</FieldError> : null}
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                {copy.cancel}
              </Button>
              <Button type="submit" loading={busy} disabled={!email.trim()}>
                {copy.send}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <form onSubmit={handleConfirm} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>{copy.codeTitle}</DialogTitle>
              <DialogDescription>{copy.sentTo(email)}</DialogDescription>
            </DialogHeader>
            <Field data-invalid={error ? true : undefined}>
              <FieldLabel htmlFor="change-email-code">{copy.code}</FieldLabel>
              <OtpInput
                id="change-email-code"
                value={otp}
                onChange={setOtp}
                label={copy.code}
                invalid={Boolean(error)}
                disabled={busy}
              />
              {error ? <FieldError>{error}</FieldError> : null}
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleBack} disabled={busy}>
                {copy.back}
              </Button>
              <Button type="submit" loading={busy} disabled={otp.length < 6}>
                {copy.confirm}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
