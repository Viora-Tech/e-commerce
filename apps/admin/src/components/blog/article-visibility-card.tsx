'use client'

import type { ArticleStatus } from '@commerce/core/blog'
import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import { RadioGroup, RadioGroupItem } from '@commerce/ui/shadcn/radio-group'
import DateField from '@/components/fields/date-field'
import DataCard from '@/components/layout/data-card'
import { articleFormContent } from '@/data/blog'
import { useCopy } from '@/hooks/use-copy'
import { formatDateTime } from '@/lib/format-date'
import { fromLocalInput } from './form-state'

type ArticleVisibilityCardProps = {
  status: ArticleStatus
  publishedAt: string
  onChange: (patch: { status?: ArticleStatus; publishedAt?: string }) => void
}

const OPTIONS = ['published', 'scheduled', 'draft'] as const

/** Visible now, visible from a date and time, or hidden. */
export default function ArticleVisibilityCard({
  status,
  publishedAt,
  onChange,
}: ArticleVisibilityCardProps) {
  // Hooks
  const { visibility: copy } = useCopy(articleFormContent)

  // Event handlers
  const handleStatus = (next: ArticleStatus) => {
    // Publishing now keeps an earlier date; a draft forgets it; scheduling asks for one.
    if (next === 'draft') onChange({ status: next, publishedAt: '' })
    else onChange({ status: next })
  }

  // Render logic
  // The field holds Indian wall time; read it as that instant, not the runtime zone's.
  const publishedOn = fromLocalInput(publishedAt)
  const help =
    status === 'published'
      ? copy.publishedHelp(publishedOn ? formatDateTime(publishedOn) : null)
      : status === 'scheduled'
        ? copy.scheduledHelp
        : copy.draftHelp

  return (
    <DataCard title={copy.heading} bodyClassName="flex flex-col gap-4">
      <RadioGroup value={status} onValueChange={(v) => handleStatus(String(v) as ArticleStatus)}>
        {OPTIONS.map((option) => (
          <Field key={option} orientation="horizontal">
            <RadioGroupItem id={`article-visibility-${option}`} value={option} />
            <FieldLabel htmlFor={`article-visibility-${option}`} className="font-normal">
              {copy[option]}
            </FieldLabel>
          </Field>
        ))}
      </RadioGroup>
      {status === 'scheduled' ? (
        <Field>
          <FieldLabel htmlFor="article-published-at">{copy.when}</FieldLabel>
          <DateField
            mode="datetime"
            id="article-published-at"
            value={publishedAt}
            onChange={(v) => onChange({ publishedAt: v })}
          />
          <FieldDescription>{copy.tz}</FieldDescription>
        </Field>
      ) : null}
      <p className="text-body text-muted-foreground">{help}</p>
    </DataCard>
  )
}
