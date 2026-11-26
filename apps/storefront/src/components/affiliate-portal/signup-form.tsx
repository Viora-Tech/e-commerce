'use client'

import { PROMOTE_CHANNELS, type SignupField } from '@commerce/plugin-affiliates/settings'
import { Button } from '@commerce/ui/shadcn/button'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { affiliateContent } from '@/data/affiliate'
import { applyAffiliateAction } from '@/lib/affiliate-actions'
import SignupQuestions from './signup-questions'

type SignupFormProps = {
  defaultName: string
  /** The account's email, where the answer is sent. */
  email: string | null
  terms: string
  /** `?program=` slug of the program applied to; none is the default program. */
  program?: string | undefined
  fields: SignupField[]
}

const copy = affiliateContent.apply

/** "Asha Rao Iyer" → ["Asha", "Rao Iyer"]. */
function splitName(name: string): [string, string] {
  const [first = '', ...rest] = name.trim().split(/\s+/)
  return [first, rest.join(' ')]
}

/** A red star after a required field's label. */
const REQUIRED = (
  <span aria-hidden className="text-destructive">
    {' *'}
  </span>
)

/**
 * The application: first and last name, the account's email, where they post and share, the
 * program's own questions, an optional UPI ID and the terms. The store reviews it (or approves
 * it at once, if it chose to); the page then shows where it stands.
 */
export default function SignupForm({
  defaultName,
  email,
  terms,
  program,
  fields,
}: SignupFormProps) {
  // Hooks
  const router = useRouter()
  const [pending, start] = useTransition()
  const [first, setFirst] = useState(() => splitName(defaultName)[0])
  const [last, setLast] = useState(() => splitName(defaultName)[1])
  const [social, setSocial] = useState('')
  const [channels, setChannels] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [upiId, setUpiId] = useState('')
  const [accept, setAccept] = useState(false)
  const [answers, setAnswers] = useState<Record<string, string | boolean>>({})
  const [error, setError] = useState<string | null>(null)

  // Event handlers
  const handleChannel = (channel: string) =>
    setChannels((c) => (c.includes(channel) ? c.filter((x) => x !== channel) : [...c, channel]))
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const upi = upiId.trim()
    start(async () => {
      const r = await applyAffiliateAction({
        name: `${first.trim()} ${last.trim()}`.trim(),
        social,
        message,
        acceptTerms: accept,
        program,
        answers,
        channels,
        payout: upi ? { method: 'upi', upiId: upi } : undefined,
      })
      if (r.ok) router.refresh()
      else setError(copy.errors[r.error] ?? copy.errors.generic ?? '')
    })
  }

  // Render logic
  return (
    <form onSubmit={handleSubmit}>
      <FieldGroup>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="su-first">
              {copy.firstName}
              {REQUIRED}
            </FieldLabel>
            <Input
              id="su-first"
              autoComplete="given-name"
              required
              maxLength={60}
              value={first}
              onChange={(e) => setFirst(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="su-last">{copy.lastName}</FieldLabel>
            <Input
              id="su-last"
              autoComplete="family-name"
              maxLength={60}
              value={last}
              onChange={(e) => setLast(e.target.value)}
            />
          </Field>
        </div>
        {email ? (
          <Field>
            <FieldLabel htmlFor="su-email">{copy.email}</FieldLabel>
            <Input
              id="su-email"
              type="email"
              readOnly
              value={email}
              className="text-muted-foreground"
            />
            <FieldDescription>{copy.as}</FieldDescription>
          </Field>
        ) : null}
        <Field>
          <FieldLabel htmlFor="su-social">{copy.social}</FieldLabel>
          <Input
            id="su-social"
            maxLength={200}
            autoCapitalize="none"
            value={social}
            onChange={(e) => setSocial(e.target.value)}
          />
          <FieldDescription>{copy.socialHint}</FieldDescription>
        </Field>
        <FieldSet>
          <FieldLegend variant="label">{copy.channels}</FieldLegend>
          <div className="flex flex-wrap gap-2">
            {PROMOTE_CHANNELS.map((c) => (
              <Button
                key={c}
                type="button"
                size="sm"
                variant={channels.includes(c) ? 'secondary' : 'outline'}
                aria-pressed={channels.includes(c)}
                className={channels.includes(c) ? 'border-primary' : ''}
                onClick={() => handleChannel(c)}
              >
                {copy.channel[c] ?? c}
              </Button>
            ))}
          </div>
        </FieldSet>
        <Field>
          <FieldLabel htmlFor="su-message">{copy.message}</FieldLabel>
          <Textarea
            id="su-message"
            maxLength={2000}
            placeholder={copy.messageHint}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </Field>
        <SignupQuestions
          fields={fields}
          values={answers}
          onChange={(id, value) => setAnswers((a) => ({ ...a, [id]: value }))}
        />
        <Field>
          <FieldLabel htmlFor="su-upi">{copy.payoutTitle}</FieldLabel>
          <Input
            id="su-upi"
            autoComplete="off"
            autoCapitalize="none"
            inputMode="email"
            maxLength={100}
            placeholder={copy.upiPlaceholder}
            value={upiId}
            onChange={(e) => setUpiId(e.target.value)}
          />
          <FieldDescription>{copy.payoutHint}</FieldDescription>
        </Field>
        {terms ? (
          <details className="rounded-lg border p-3 text-sm">
            <summary className="cursor-pointer font-medium">{copy.termsTitle}</summary>
            <p className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap text-muted-foreground">
              {terms}
            </p>
          </details>
        ) : null}
        <Field orientation="horizontal">
          <Checkbox
            id="su-terms"
            required
            checked={accept}
            onCheckedChange={(on) => setAccept(on === true)}
          />
          <FieldLabel htmlFor="su-terms">
            {copy.terms}
            {REQUIRED}
          </FieldLabel>
        </Field>
        {error ? <FieldError>{error}</FieldError> : null}
        <Button type="submit" size="lg" className="w-full" loading={pending} disabled={!accept}>
          {pending ? copy.sending : copy.submit}
        </Button>
      </FieldGroup>
    </form>
  )
}
