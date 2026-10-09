'use client'

import type { ArticleStatus } from '@commerce/core/blog'
import { Card, CardContent, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { RadioGroup, RadioGroupItem } from '@commerce/ui/shadcn/radio-group'
import { articleFormContent } from '@/data/blog'
import { useCopy } from '@/hooks/use-copy'
import { formatDateTime } from '@/lib/format-date'

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
  const help =
    status === 'published'
      ? copy.publishedHelp(publishedAt ? formatDateTime(publishedAt) : null)
      : status === 'scheduled'
        ? copy.scheduledHelp
        : copy.draftHelp

  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.heading}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
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
            <Input
              id="article-published-at"
              size="lg"
              type="datetime-local"
              value={publishedAt}
              onChange={(e) => onChange({ publishedAt: e.target.value })}
            />
            <FieldDescription>{copy.tz}</FieldDescription>
          </Field>
        ) : null}
        <p className="text-body text-muted-foreground">{help}</p>
      </CardContent>
    </Card>
  )
}
