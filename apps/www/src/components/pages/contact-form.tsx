'use client'

import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { Input } from '@commerce/ui/shadcn/input'
import { Label } from '@commerce/ui/shadcn/label'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import { useActionState, useState } from 'react'
import { contactContent } from '@/data/contact'
import { ctaClass } from '@/lib/cta'
import { FORM_INITIAL } from '@/lib/form-state'
import { sendContactMessage } from '@/lib/forms-action'
import ChoiceChip from '../common/choice-chip'

const copy = contactContent.form

type TextFieldProps = {
  id: string
  label: string
  placeholder: string
  type?: string
  error: string | undefined
  autoComplete?: string
  className?: string
}

function TextField({
  id,
  label,
  placeholder,
  type = 'text',
  error,
  autoComplete,
  className,
}: TextFieldProps) {
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ''}`}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={id}
        type={type}
        size="lg"
        autoComplete={autoComplete}
        placeholder={placeholder}
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

export default function ContactForm() {
  // Hooks
  const [state, formAction, pending] = useActionState(sendContactMessage, FORM_INITIAL)
  const [topic, setTopic] = useState(copy.topics[0])

  return (
    <form
      action={formAction}
      noValidate
      className="surface-card mx-auto flex w-full max-w-4xl flex-col gap-6 rounded-3xl p-6 md:p-10"
    >
      <h2 className="text-2xl font-semibold text-foreground">{copy.title}</h2>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-sm text-muted-foreground">{copy.topicLabel}</legend>
        <div className="flex flex-wrap gap-2">
          {copy.topics.map((item) => (
            <ChoiceChip
              key={item}
              label={item}
              selected={topic === item}
              onSelect={() => setTopic(item)}
            />
          ))}
        </div>
        <input type="hidden" name="topic" value={topic} />
      </fieldset>
      <div className="grid gap-4 md:grid-cols-2">
        <TextField
          id="name"
          label={copy.name.label}
          placeholder={copy.name.placeholder}
          autoComplete="name"
          error={state.errors.name}
        />
        <TextField
          id="email"
          label={copy.email.label}
          placeholder={copy.email.placeholder}
          type="email"
          autoComplete="email"
          error={state.errors.email}
        />
        <TextField
          id="store"
          label={copy.store.label}
          placeholder={copy.store.placeholder}
          error={undefined}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="message">{copy.message.label}</Label>
        <Textarea
          id="message"
          name="message"
          rows={4}
          placeholder={copy.message.placeholder}
          aria-invalid={state.errors.message ? true : undefined}
        />
        {state.errors.message ? (
          <p className="text-sm text-destructive">{state.errors.message}</p>
        ) : null}
      </div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <Label className="flex items-center gap-2 font-medium">
            <Checkbox name="consent" />
            {copy.consent}
          </Label>
          {state.errors.consent ? (
            <p className="text-sm text-destructive">{state.errors.consent}</p>
          ) : null}
        </div>
        <button type="submit" disabled={pending} className={ctaClass('lg')}>
          {pending ? copy.sending : copy.submit}
        </button>
      </div>
      {state.status === 'success' ? (
        <p role="status" className="text-sm text-foreground">
          {copy.success}
        </p>
      ) : null}
    </form>
  )
}
