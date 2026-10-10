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
import OtpInput from '@/components/auth/otp-input'
import { accountContent } from '@/data/account'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { authClient } from '@/lib/auth-client'
import { routes } from '@/lib/routes'

type DeleteAccountDialogProps = {
  open: boolean
  /** The sign-in email the member has to type out. */
  email: string
  onOpenChange: (open: boolean) => void
}

/** Same rule as the server: the sign-in email, ignoring case and outer spaces. */
const matches = (typed: string, email: string) =>
  typed.trim().toLowerCase() === email.trim().toLowerCase()

/**
 * The last step before deleting an account: type the sign-in email, get a code by email,
 * enter it. On success the member is signed out and lands on the login page.
 */
export default function DeleteAccountDialog({
  open,
  email,
  onOpenChange,
}: DeleteAccountDialogProps) {
  // Hooks
  const {
    profile: {
      danger: { dialog: copy },
    },
  } = useCopy(accountContent)
  const [typed, setTyped] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [otp, setOtp] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleOpenChange = (next: boolean) => {
    if (busy) return
    if (!next) {
      setTyped('')
      setCodeSent(false)
      setOtp('')
      setError(null)
    }
    onOpenChange(next)
  }

  const handleSendCode = async (e: FormEvent) => {
    e.preventDefault()
    if (!matches(typed, email)) {
      setError(copy.mismatch)
      return
    }
    setBusy(true)
    setError(null)
    try {
      await api.account.sendDeletionCode()
      setCodeSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.account.deleteAccount({ email: typed, otp })
      toast.success(copy.done)
      // The session row went with the account; this clears the cookies.
      await authClient.signOut().catch(() => undefined)
      window.location.assign(routes.login())
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.failed)
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={codeSent ? handleDelete : handleSendCode} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{copy.title}</DialogTitle>
            <DialogDescription>{codeSent ? copy.codeSent(email) : copy.body}</DialogDescription>
          </DialogHeader>
          {codeSent ? (
            <Field data-invalid={error ? true : undefined}>
              <FieldLabel htmlFor="delete-account-code">{copy.code}</FieldLabel>
              <OtpInput
                id="delete-account-code"
                value={otp}
                onChange={setOtp}
                label={copy.code}
                invalid={Boolean(error)}
                disabled={busy}
              />
              {error ? <FieldError>{error}</FieldError> : null}
            </Field>
          ) : (
            <Field data-invalid={error ? true : undefined}>
              <FieldLabel htmlFor="delete-account-email">{copy.typeEmail(email)}</FieldLabel>
              <Input
                id="delete-account-email"
                size="lg"
                autoComplete="off"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                aria-invalid={error ? true : undefined}
                disabled={busy}
              />
              {error ? <FieldError>{error}</FieldError> : null}
            </Field>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={busy}
            >
              {copy.cancel}
            </Button>
            {codeSent ? (
              <Button type="submit" variant="destructive" loading={busy} disabled={otp.length < 6}>
                {copy.confirm}
              </Button>
            ) : (
              <Button type="submit" variant="destructive" loading={busy} disabled={!typed.trim()}>
                {copy.sendCode}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
