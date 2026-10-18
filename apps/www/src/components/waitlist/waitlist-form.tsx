'use client'

import { ArrowRight, CircleAlert, CircleCheck } from '@commerce/ui/icons'
import { Input } from '@commerce/ui/shadcn/input'
import { Label } from '@commerce/ui/shadcn/label'
import Link from 'next/link'
import { useActionState, useEffect, useState } from 'react'
import { waitlistContent as copy, WAITLIST_INITIAL } from '@/data/waitlist'
import { ctaClass } from '@/lib/cta'
import { joinWaitlist } from '@/lib/waitlist-action'
import ChoiceChip from '../common/choice-chip'
import Turnstile from '../common/turnstile'

type WaitlistFormProps = { initialEmail: string; initialSell: string; onJoined: () => void }

type FieldProps = {
  id: string
  label: string
  type?: string
  placeholder: string
  value: string
  onChange: (value: string) => void
  error: string | undefined
  autoComplete?: string
  inputMode?: 'email' | 'tel' | 'text'
}

function Field({
  id,
  label,
  type = 'text',
  placeholder,
  value,
  onChange,
  error,
  autoComplete,
  inputMode,
}: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={id}
        type={type}
        size="lg"
        autoComplete={autoComplete}
        inputMode={inputMode}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error ? (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export default function WaitlistForm({ initialEmail, initialSell, onJoined }: WaitlistFormProps) {
  // Hooks
  const [state, formAction, pending] = useActionState(joinWaitlist, WAITLIST_INITIAL)
  const [email, setEmail] = useState(initialEmail)
  const [sell, setSell] = useState(initialSell)
  const [channels, setChannels] = useState<string[]>([])

  useEffect(() => {
    if (state.status === 'success') onJoined()
  }, [state.status, onJoined])

  // Event handlers
  const toggleChannel = (option: string) =>
    setChannels((current) =>
      current.includes(option) ? current.filter((item) => item !== option) : [...current, option],
    )

  // Render logic
  const alert =
    state.status === 'error'
      ? { Icon: CircleAlert, ...copy.error }
      : state.status === 'duplicate'
        ? { Icon: CircleCheck, ...copy.duplicate }
        : null

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {alert ? (
        <div role="alert" className="flex gap-3 rounded-lg border border-border bg-card p-3">
          <alert.Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-foreground" />
          <div className="text-sm">
            <p className="font-semibold text-foreground">{alert.title}</p>
            <p className="text-muted-foreground">{alert.body}</p>
          </div>
        </div>
      ) : null}
      <Field
        id="email"
        label={copy.email.label}
        type="email"
        autoComplete="email"
        inputMode="email"
        placeholder={copy.email.placeholder}
        value={email}
        onChange={setEmail}
        error={state.errors.email}
      />
      <Field
        id="sell"
        label={copy.sell.label}
        placeholder={copy.sell.placeholder}
        value={sell}
        onChange={setSell}
        error={state.errors.sell}
      />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm text-foreground">
          {copy.channels.label}{' '}
          <span className="text-muted-foreground">{copy.channels.optional}</span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {copy.channels.options.map((option) => (
            <ChoiceChip
              key={option}
              label={option}
              selected={channels.includes(option)}
              onSelect={() => toggleChannel(option)}
            />
          ))}
        </div>
        {channels.map((option) => (
          <input key={option} type="hidden" name="channels" value={option} />
        ))}
      </fieldset>
      <Turnstile action="waitlist" />
      <button type="submit" disabled={pending} className={ctaClass('lg', 'w-full')}>
        {pending ? copy.sending : copy.submit}
        {pending ? null : <ArrowRight aria-hidden />}
      </button>
      <p className="text-center text-xs text-muted-foreground">
        {copy.legalPrefix}{' '}
        <Link href="/terms" className="text-foreground underline-offset-2 hover:underline">
          {copy.terms}
        </Link>{' '}
        {copy.and}{' '}
        <Link href="/privacy" className="text-foreground underline-offset-2 hover:underline">
          {copy.privacy}
        </Link>
        .
      </p>
    </form>
  )
}
