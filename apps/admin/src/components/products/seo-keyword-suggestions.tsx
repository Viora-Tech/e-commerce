'use client'

import { SEO_KEYWORDS_MAX, type SuggestedKeyword } from '@commerce/ai/client'
import { StarIcon } from '@commerce/ui/icons'
import { Badge } from '@commerce/ui/shadcn/badge'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { useState } from 'react'
import KitButton from '@/components/kit/kit-button'
import { seoKeywordsContent } from '@/data/seo-keywords'
import { useCopy } from '@/hooks/use-copy'

type SeoKeywordSuggestionsProps = {
  suggestions: SuggestedKeyword[]
  /** Real Search Console queries the suggestions were grounded in. */
  searchQueries: number
  /** Keywords the product has now: those are shown as already added. */
  current: string[]
  onUse: (picked: SuggestedKeyword[]) => void
  onDismiss: () => void
}

const INTENT_BADGE = { buy: 'success', compare: 'info', info: 'neutral' } as const

/** The AI's keywords, each with its intent, to tick and add to the product. */
export default function SeoKeywordSuggestions({
  suggestions,
  searchQueries,
  current,
  onUse,
  onDismiss,
}: SeoKeywordSuggestionsProps) {
  // Hooks
  const copy = useCopy(seoKeywordsContent)
  /* New suggestions start ticked, as many as still fit on the product. */
  const [picked, setPicked] = useState<string[]>(() =>
    suggestions
      .filter((s) => !current.includes(s.keyword))
      .slice(0, Math.max(0, SEO_KEYWORDS_MAX - current.length))
      .map((s) => s.keyword),
  )

  // Helpers
  const toggle = (keyword: string, on: boolean) =>
    setPicked((prev) => (on ? [...prev, keyword] : prev.filter((k) => k !== keyword)))

  // Event handlers
  const handleUse = () => onUse(suggestions.filter((s) => picked.includes(s.keyword)))

  // Render logic
  const room = SEO_KEYWORDS_MAX - current.length

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-primary/40 bg-primary/5 p-3.5">
      <div className="flex flex-col gap-0.5">
        <h3 className="text-body-strong text-ink-strong">{copy.suggestions.heading}</h3>
        <p className="text-caption text-muted-foreground">{copy.suggestions.hint}</p>
        {searchQueries > 0 ? (
          <p className="text-caption text-muted-foreground">
            {copy.suggestions.fromSearch(searchQueries)}
          </p>
        ) : null}
      </div>
      <ul className="flex flex-col gap-1.5">
        {suggestions.map((s, i) => {
          const added = current.includes(s.keyword)
          const checked = added || picked.includes(s.keyword)
          const inputId = `keyword-pick-${i}`
          return (
            <li key={s.keyword}>
              <label
                htmlFor={inputId}
                className="flex min-w-0 cursor-pointer items-center gap-2.5 rounded-lg bg-card px-3 py-2"
              >
                <Checkbox
                  id={inputId}
                  checked={checked}
                  disabled={added || (!checked && picked.length >= room)}
                  onCheckedChange={(on) => toggle(s.keyword, on === true)}
                />
                <span className="min-w-0 flex-1 truncate text-body text-foreground">
                  {s.keyword}
                </span>
                {s.primary ? (
                  <>
                    <StarIcon weight="fill" className="size-4 shrink-0 text-primary" />
                    <span className="sr-only">{copy.primary}</span>
                  </>
                ) : null}
                {s.seen ? <Badge variant="warning">{copy.suggestions.seen}</Badge> : null}
                <Badge variant={INTENT_BADGE[s.intent]}>{copy.suggestions.intents[s.intent]}</Badge>
              </label>
            </li>
          )
        })}
      </ul>
      <div className="flex flex-wrap justify-end gap-2">
        <KitButton variant="secondary" onClick={onDismiss}>
          {copy.suggestions.dismiss}
        </KitButton>
        <KitButton variant="primary" onClick={handleUse} disabled={!picked.length}>
          {copy.suggestions.use(picked.length)}
        </KitButton>
      </div>
    </section>
  )
}
