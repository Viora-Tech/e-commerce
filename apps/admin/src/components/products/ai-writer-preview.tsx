'use client'

import { containsKeyword, type ProductCopy } from '@commerce/ai/client'
import { type RichTextValue, richTextToPlainText } from '@commerce/richtext'
import { cn } from '@commerce/ui/lib/utils'
import { Badge } from '@commerce/ui/shadcn/badge'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import type { ReactNode } from 'react'
import { aiContent } from '@/data/ai'
import { seoKeywordsContent } from '@/data/seo-keywords'
import { useCopy } from '@/hooks/use-copy'
import { type ApplyPicks, newTags } from '@/lib/ai-product-copy'

type AiWriterPreviewProps = {
  copy: ProductCopy
  picks: ApplyPicks
  current: {
    description: RichTextValue | null
    seoTitle: string
    seoDescription: string
    tags: string[]
  }
  /** The product's primary search keyword, to say whether the search text uses it. */
  primaryKeyword: string | null
  onPicks: (picks: ApplyPicks) => void
}

/** Now vs suggested for each part, each with its own "use this" tick. */
export default function AiWriterPreview({
  copy,
  picks,
  current,
  primaryKeyword,
  onPicks,
}: AiWriterPreviewProps) {
  // Hooks
  const text = useCopy(aiContent)
  const keywordCopy = useCopy(seoKeywordsContent.writer)

  // Helpers
  const toggle = (key: keyof ApplyPicks) => (on: boolean) => onPicks({ ...picks, [key]: on })
  /* Whether a suggested search field uses the primary keyword; nothing without one. */
  const keywordHint = (value: string) => {
    if (!primaryKeyword) return undefined
    return containsKeyword(value, primaryKeyword)
      ? keywordCopy.using(primaryKeyword)
      : keywordCopy.missing(primaryKeyword)
  }

  // Render logic
  const currentDescription = richTextToPlainText(current.description).trim()
  const added = newTags(current.tags, copy.tags)

  return (
    <div className="flex flex-col gap-3">
      <PickRow
        id="description"
        label={text.writer.fields.description}
        checked={picks.description}
        onChange={toggle('description')}
        now={currentDescription}
        emptyLabel={text.writer.empty}
        nowLabel={text.writer.now}
        suggestedLabel={text.writer.suggested}
      >
        <div className="flex flex-col gap-2">
          {copy.intro ? <p>{copy.intro}</p> : null}
          {copy.highlights.length ? (
            <ul className="list-disc space-y-1 pl-5">
              {copy.highlights.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          ) : null}
          {copy.closing ? <p>{copy.closing}</p> : null}
        </div>
      </PickRow>
      <PickRow
        id="specs"
        label={text.writer.fields.specs}
        hint={copy.specs.length ? text.writer.specsHint : undefined}
        checked={picks.specs && copy.specs.length > 0}
        disabled={copy.specs.length === 0}
        onChange={toggle('specs')}
        nowLabel={text.writer.now}
        suggestedLabel={text.writer.suggested}
        emptyLabel={text.writer.empty}
      >
        {copy.specs.length ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            {copy.specs.map((s) => (
              <div key={s.label} className="contents">
                <dt className="text-muted-foreground">{s.label}</dt>
                <dd>{s.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-muted-foreground">{text.writer.noSpecs}</p>
        )}
      </PickRow>
      <PickRow
        id="seo-title"
        label={text.writer.fields.seoTitle}
        hint={keywordHint(copy.seoTitle)}
        checked={picks.seoTitle}
        onChange={toggle('seoTitle')}
        now={current.seoTitle}
        nowLabel={text.writer.now}
        suggestedLabel={text.writer.suggested}
        emptyLabel={text.writer.empty}
      >
        <p>{copy.seoTitle}</p>
      </PickRow>
      <PickRow
        id="seo-description"
        label={text.writer.fields.seoDescription}
        hint={keywordHint(copy.seoDescription)}
        checked={picks.seoDescription}
        onChange={toggle('seoDescription')}
        now={current.seoDescription}
        nowLabel={text.writer.now}
        suggestedLabel={text.writer.suggested}
        emptyLabel={text.writer.empty}
      >
        <p>{copy.seoDescription}</p>
      </PickRow>
      <PickRow
        id="tags"
        label={text.writer.fields.tags}
        hint={added.length ? text.writer.tagsHint(added.length) : text.writer.noNewTags}
        checked={picks.tags && added.length > 0}
        disabled={added.length === 0}
        onChange={toggle('tags')}
        nowLabel={text.writer.now}
        suggestedLabel={text.writer.suggested}
        emptyLabel={text.writer.empty}
      >
        <div className="flex flex-wrap gap-1.5">
          {copy.tags.map((t) => (
            <Badge key={t} variant={added.includes(t) ? 'default' : 'neutral'}>
              {t}
            </Badge>
          ))}
        </div>
      </PickRow>
    </div>
  )
}

type PickRowProps = {
  id: string
  label: string
  hint?: string | undefined
  checked: boolean
  disabled?: boolean | undefined
  onChange: (on: boolean) => void
  /** Plain text of what the field holds today; omitted for parts with no "now" (specs). */
  now?: string | undefined
  nowLabel: string
  suggestedLabel: string
  emptyLabel: string
  children: ReactNode
}

function PickRow({
  id,
  label,
  hint,
  checked,
  disabled,
  onChange,
  now,
  nowLabel,
  suggestedLabel,
  emptyLabel,
  children,
}: PickRowProps) {
  // Render logic
  const inputId = `ai-pick-${id}`

  return (
    <section
      className={cn(
        'flex flex-col gap-3 rounded-xl border p-4 transition-colors',
        checked ? 'border-primary/40 bg-primary/5' : 'border-border bg-card',
      )}
    >
      <label htmlFor={inputId} className="flex cursor-pointer items-start gap-3">
        <Checkbox
          id={inputId}
          checked={checked}
          disabled={disabled}
          onCheckedChange={(v) => onChange(Boolean(v))}
          className="mt-0.5"
        />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-body-strong text-ink-strong">{label}</span>
          {hint ? <span className="text-caption text-muted-foreground">{hint}</span> : null}
        </span>
      </label>
      {now !== undefined ? (
        <div className="flex flex-col gap-1 pl-7">
          <span className="text-caption font-medium text-muted-foreground uppercase">
            {nowLabel}
          </span>
          <p className="line-clamp-3 text-body text-muted-foreground">{now || emptyLabel}</p>
        </div>
      ) : null}
      <div className="flex flex-col gap-1 pl-7">
        {now !== undefined ? (
          <span className="text-caption font-medium text-primary uppercase">{suggestedLabel}</span>
        ) : null}
        <div className="text-body text-ink-strong">{children}</div>
      </div>
    </section>
  )
}
