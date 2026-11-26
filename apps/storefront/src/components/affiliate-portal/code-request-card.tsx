'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { Field, FieldError, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { useState, useTransition } from 'react'
import { affiliateContent } from '@/data/affiliate'
import { affiliatePortalContent } from '@/data/affiliate-portal'
import { requestCodeAction } from '@/lib/affiliate-actions'
import CopyField from './copy-field'

type CodeRequestCardProps = {
  code: string
  /** Their last request for their own code, if any. */
  request: { code: string; status: 'pending' | 'approved' | 'declined' } | null
}

const copy = affiliateContent.dashboard.vanity

/** Their referral code, and asking the store for one of their own (`asha` for `asha-k2`). */
export default function CodeRequestCard({ code, request }: CodeRequestCardProps) {
  // Hooks
  const [pending, start] = useTransition()
  const [wanted, setWanted] = useState('')
  const [sent, setSent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Event handlers
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    start(async () => {
      const r = await requestCodeAction(wanted)
      if (r.ok) setSent(wanted.trim().toLowerCase())
      else setError(copy.errors[r.error] ?? copy.errors.generic ?? '')
    })
  }

  // Render logic
  const waiting = sent ?? (request?.status === 'pending' ? request.code : null)
  const label = affiliatePortalContent.settings.profile.code
  return (
    <Card>
      <CardHeader>
        <CardTitle>{label}</CardTitle>
        <CardDescription>{copy.help}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <CopyField value={code} label={label} />
        {waiting ? (
          <p className="text-sm text-muted-foreground" role="status">
            {copy.waiting(waiting)}
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {request?.status === 'declined' ? (
              <p className="text-sm text-muted-foreground">{copy.declined(request.code)}</p>
            ) : null}
            <Field data-invalid={error ? true : undefined}>
              <FieldLabel htmlFor="code-wanted">{copy.label}</FieldLabel>
              <div className="flex gap-2">
                <Input
                  id="code-wanted"
                  value={wanted}
                  maxLength={24}
                  autoCapitalize="none"
                  aria-invalid={error ? true : undefined}
                  onChange={(e) => setWanted(e.target.value)}
                />
                <Button
                  type="submit"
                  variant="outline"
                  loading={pending}
                  disabled={wanted.trim().length < 3}
                >
                  {copy.submit}
                </Button>
              </div>
              {error ? <FieldError>{error}</FieldError> : null}
            </Field>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
