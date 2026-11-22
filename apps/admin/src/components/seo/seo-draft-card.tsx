'use client'

import { SEO_ASSISTANT_LIMITS } from '@commerce/core/seo-assistant'
import { Button } from '@commerce/ui/shadcn/button'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { Input } from '@commerce/ui/shadcn/input'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import { useState } from 'react'
import { seoAssistantContent } from '@/data/seo-assistant'
import { useCopy } from '@/hooks/use-copy'
import type { SeoFixTarget } from './seo-fix-dialog'

/** One item in the Fix with AI preview: the draft, or why there is none. */
export type SeoDraftState = {
  target: SeoFixTarget
  failed: 'not_found' | 'model_failed' | null
  include: boolean
  seoTitle?: string | undefined
  seoDescription?: string | undefined
  snippet?: string | undefined
  snippetWords?: number | undefined
  queries?: number | undefined
}

type SeoDraftCardProps = {
  draft: SeoDraftState
  onChange: (next: SeoDraftState) => void
}

/** The text Google shows now for a field, or a placeholder when there is none. */
const shownNow = (value: string | null, empty: string) => value?.trim() || empty

/** Before and after for one item's search title and description, editable, plus the snippet. */
export default function SeoDraftCard({ draft, onChange }: SeoDraftCardProps) {
  // Hooks
  const copy = useCopy(seoAssistantContent.fix)
  const [copied, setCopied] = useState(false)

  // Event handlers
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(draft.snippet ?? '')
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  // Early returns
  if (draft.failed) {
    return (
      <section className="flex flex-col gap-1 rounded-lg border border-border p-3">
        <h3 className="text-body-strong text-ink-strong">{draft.target.title}</h3>
        <p className="text-body text-danger">
          {draft.failed === 'not_found' ? copy.notFound : copy.itemFailed}
        </p>
      </section>
    )
  }

  // Render logic
  const id = `seo-draft-${draft.target.resource}-${draft.target.id}`
  const title = draft.seoTitle ?? ''
  const description = draft.seoDescription ?? ''
  const fields = [
    {
      key: 'title',
      label: copy.seoTitle,
      now: shownNow(draft.target.seoTitle, copy.empty),
      value: title,
      max: SEO_ASSISTANT_LIMITS.titleMax,
    },
    {
      key: 'description',
      label: copy.seoDescription,
      now: shownNow(draft.target.seoDescription, copy.empty),
      value: description,
      max: SEO_ASSISTANT_LIMITS.descriptionMax,
    },
  ] as const

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="truncate text-body-strong text-ink-strong">{draft.target.title}</h3>
        <label htmlFor={`${id}-include`} className="flex items-center gap-2 text-body">
          <Checkbox
            id={`${id}-include`}
            checked={draft.include}
            onCheckedChange={(on) => onChange({ ...draft, include: on === true })}
          />
          {copy.include}
        </label>
      </div>
      <p className="text-caption text-muted-foreground">{copy.fromSearches(draft.queries ?? 0)}</p>
      {fields.map((f) => (
        <div key={f.key} className="grid gap-2 md:grid-cols-2">
          <div className="flex flex-col gap-1">
            <span className="text-caption text-muted-foreground">
              {f.label} · {copy.before}
            </span>
            <p className="rounded-md bg-muted/50 px-2.5 py-1.5 text-body text-muted-foreground line-through decoration-muted-foreground/40">
              {f.now}
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-${f.key}`} className="text-caption text-muted-foreground">
              {f.label} · {copy.after}
            </label>
            {f.key === 'title' ? (
              <Input
                id={`${id}-${f.key}`}
                value={f.value}
                maxLength={f.max}
                onChange={(e) => onChange({ ...draft, seoTitle: e.target.value })}
              />
            ) : (
              <Textarea
                id={`${id}-${f.key}`}
                value={f.value}
                maxLength={f.max}
                rows={3}
                onChange={(e) => onChange({ ...draft, seoDescription: e.target.value })}
              />
            )}
            <span className="text-caption text-muted-foreground">
              {copy.chars(f.value.length, f.max)}
            </span>
          </div>
        </div>
      ))}
      {draft.snippet ? (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-caption text-muted-foreground">{copy.snippet}</span>
            <Button type="button" variant="ghost" size="sm" onClick={handleCopy}>
              {copied ? copy.copied : copy.copy}
            </Button>
          </div>
          <p className="whitespace-pre-line rounded-md bg-primary/5 px-2.5 py-2 text-body text-foreground">
            {draft.snippet}
          </p>
          <span className="text-caption text-muted-foreground">
            {copy.snippetHint(draft.snippetWords ?? 0)}
          </span>
        </div>
      ) : null}
    </section>
  )
}
