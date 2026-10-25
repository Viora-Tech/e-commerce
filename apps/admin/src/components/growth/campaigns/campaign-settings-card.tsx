'use client'

import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import Link from 'next/link'
import DataCard from '@/components/layout/data-card'
import { campaignEditorContent } from '@/data/marketing-campaigns'
import { routes } from '@/lib/routes'
import type { CampaignForm } from './form-state'

type CampaignSettingsCardProps = {
  form: CampaignForm
  segments: { id: string; name: string }[]
  /** Customers the campaign reaches now; null while loading. */
  reach: number | null
  onChange: (patch: Partial<CampaignForm>) => void
}

const copy = campaignEditorContent
const ALL = 'all'

/** Name, audience (segment with a live reach count) and, for email, subject and preview text. */
export default function CampaignSettingsCard({
  form,
  segments,
  reach,
  onChange,
}: CampaignSettingsCardProps) {
  // Render logic
  const items = {
    [ALL]: copy.audience.all,
    ...Object.fromEntries(segments.map((s) => [s.id, s.name])),
  }

  return (
    <DataCard title={copy.details.title}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="campaign-name">{copy.details.name}</FieldLabel>
          <Input
            id="campaign-name"
            value={form.name}
            maxLength={120}
            onChange={(e) => onChange({ name: e.target.value })}
          />
          <FieldDescription>{copy.details.nameHelp}</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="campaign-segment">{copy.audience.segment}</FieldLabel>
          <Select
            items={items}
            value={form.segmentId ?? ALL}
            onValueChange={(v) => onChange({ segmentId: !v || v === ALL ? null : String(v) })}
          >
            <SelectTrigger id="campaign-segment" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{copy.audience.all}</SelectItem>
              {segments.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription>
            {reach === null ? ' ' : copy.audience.reach(reach, form.kind)}{' '}
            {form.kind === 'email' ? copy.audience.consentEmail : copy.audience.consentWhatsapp}{' '}
            <Link href={routes.customers.segments()} className="underline">
              {copy.audience.manageSegments}
            </Link>
          </FieldDescription>
        </Field>
        {form.kind === 'email' ? (
          <>
            <Field>
              <FieldLabel htmlFor="campaign-subject">{copy.email.subject}</FieldLabel>
              <Input
                id="campaign-subject"
                value={form.subject}
                maxLength={200}
                onChange={(e) => onChange({ subject: e.target.value })}
              />
              <FieldDescription>{copy.email.mergeHelp}</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="campaign-preview">{copy.email.previewText}</FieldLabel>
              <Input
                id="campaign-preview"
                value={form.previewText}
                maxLength={200}
                onChange={(e) => onChange({ previewText: e.target.value })}
              />
              <FieldDescription>{copy.email.previewHelp}</FieldDescription>
            </Field>
          </>
        ) : null}
      </FieldGroup>
    </DataCard>
  )
}
