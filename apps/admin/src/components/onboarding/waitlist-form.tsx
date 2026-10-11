'use client'

import { CircleCheck, Loader2Icon } from '@commerce/ui/icons'
import PhoneInput from '@commerce/ui/phone-input'
import { Button } from '@commerce/ui/shadcn/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { type FormEvent, useState } from 'react'
import { onboardingContent } from '@/data/onboarding'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type WaitlistFormProps = { defaultEmail: string }

/** Mirrors the server's WaitlistEntrySchema phone rule, so a typo shows before sending. */
const PHONE = /^\+?[0-9 -]{8,16}$/

/** Invite mode: email, phone and what you sell, so the platform can invite you later. */
export default function WaitlistForm({ defaultEmail }: WaitlistFormProps) {
  // Hooks
  const copy = useCopy(onboardingContent)
  const [email, setEmail] = useState(defaultEmail)
  const [phone, setPhone] = useState('')
  const [sells, setSells] = useState('')
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Event handlers
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!PHONE.test(phone.trim())) {
      setError(copy.waitlist.invalidPhone)
      return
    }
    setSending(true)
    setError(null)
    try {
      await api.onboarding.joinWaitlist({ email, phone, sells })
      setDone(true)
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : copy.waitlist.failed)
    } finally {
      setSending(false)
    }
  }

  // Early returns
  if (done) {
    return (
      <div className="flex items-start gap-3">
        <CircleCheck className="mt-0.5 size-5 shrink-0 text-success" />
        <div className="flex flex-col gap-1">
          <p className="text-body font-medium text-ink-strong">{copy.waitlist.doneHeading}</p>
          <p className="text-body text-muted-foreground">{copy.waitlist.doneBody}</p>
        </div>
      </div>
    )
  }

  // Render logic
  const canSubmit = !sending && email.trim() && phone.trim() && sells.trim().length >= 2

  return (
    <form onSubmit={handleSubmit}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="waitlist-email">{copy.waitlist.email}</FieldLabel>
          <Input
            id="waitlist-email"
            type="email"
            size="lg"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </Field>
        <Field data-invalid={error === copy.waitlist.invalidPhone ? true : undefined}>
          <FieldLabel htmlFor="waitlist-phone">{copy.waitlist.phone}</FieldLabel>
          <PhoneInput
            id="waitlist-phone"
            value={phone}
            onChange={setPhone}
            placeholder={copy.waitlist.phonePlaceholder}
            required
            autoComplete="tel"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="waitlist-sells">{copy.waitlist.sells}</FieldLabel>
          <Input
            id="waitlist-sells"
            size="lg"
            value={sells}
            onChange={(e) => setSells(e.target.value)}
            placeholder={copy.waitlist.sellsPlaceholder}
            maxLength={300}
            required
          />
        </Field>
        {error ? <FieldError>{error}</FieldError> : null}
        <Button type="submit" size="lg" className="w-full" disabled={!canSubmit}>
          {sending ? <Loader2Icon className="size-4 animate-spin" /> : null}
          {sending ? copy.waitlist.sending : copy.waitlist.submit}
        </Button>
      </FieldGroup>
    </form>
  )
}
