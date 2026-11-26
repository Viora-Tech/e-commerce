'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { affiliatePortalContent } from '@/data/affiliate-portal'
import { saveAffiliateProfileAction } from '@/lib/portal-actions'

type ProfileFormProps = {
  name: string
  social: string
  email: string | null
  phone: string | null
}

const copy = affiliatePortalContent.settings.profile

/** Their name and main profile link (editable), and the account's email and phone (read only). */
export default function ProfileForm({ name, social, email, phone }: ProfileFormProps) {
  // Hooks
  const router = useRouter()
  const [pending, start] = useTransition()
  const [draftName, setDraftName] = useState(name)
  const [draftSocial, setDraftSocial] = useState(social)
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)

  // Event handlers
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setStatus(null)
    start(async () => {
      const r = await saveAffiliateProfileAction({ name: draftName, social: draftSocial })
      if (r.ok) {
        setStatus({ ok: true, text: copy.saved })
        router.refresh()
      } else {
        setStatus({ ok: false, text: copy.errors[r.error] ?? copy.errors.generic ?? '' })
      }
    })
  }

  // Render logic
  return (
    <form onSubmit={handleSubmit}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="pf-name">{copy.name}</FieldLabel>
          <Input
            id="pf-name"
            required
            maxLength={120}
            autoComplete="name"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="pf-social">{copy.social}</FieldLabel>
          <Input
            id="pf-social"
            maxLength={200}
            autoCapitalize="none"
            value={draftSocial}
            onChange={(e) => setDraftSocial(e.target.value)}
          />
          <FieldDescription>{copy.socialHint}</FieldDescription>
        </Field>
        {email ? (
          <Field>
            <FieldLabel htmlFor="pf-email">{copy.email}</FieldLabel>
            <Input id="pf-email" readOnly value={email} className="text-muted-foreground" />
            <FieldDescription>{copy.fromAccount}</FieldDescription>
          </Field>
        ) : null}
        {phone ? (
          <Field>
            <FieldLabel htmlFor="pf-phone">{copy.phone}</FieldLabel>
            <Input id="pf-phone" readOnly value={phone} className="text-muted-foreground" />
          </Field>
        ) : null}
        <div className="flex items-center gap-3">
          <Button type="submit" loading={pending}>
            {pending ? copy.saving : copy.save}
          </Button>
          {status ? (
            <span
              role={status.ok ? 'status' : 'alert'}
              className={`text-sm ${status.ok ? 'text-success' : 'text-destructive'}`}
            >
              {status.text}
            </span>
          ) : null}
        </div>
      </FieldGroup>
    </form>
  )
}
