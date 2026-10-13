'use client'

import { newTags } from '@commerce/ai/client'
import { StarIcon } from '@commerce/ui/icons'
import { Badge } from '@commerce/ui/shadcn/badge'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { assistantContent } from '@/data/assistant'
import { seoKeywordsContent } from '@/data/seo-keywords'
import { useCopy } from '@/hooks/use-copy'
import type { api } from '@/lib/api-client'

type Job = Awaited<ReturnType<typeof api.ai.bulkJob>>

type BulkWriteReviewProps = {
  job: Job
  selected: string[]
  onSelected: (ids: string[]) => void
}

const BADGE: Record<string, 'success' | 'destructive' | 'neutral' | 'info'> = {
  ready: 'info',
  applied: 'success',
  failed: 'destructive',
}

/** Each product in a run: its status and, once written, the suggestion to tick or untick. */
export default function BulkWriteReview({ job, selected, onSelected }: BulkWriteReviewProps) {
  // Hooks
  const copy = useCopy(assistantContent)
  const keywordCopy = useCopy(seoKeywordsContent)

  // Helpers
  const toggle = (id: string, on: boolean) =>
    onSelected(on ? [...selected, id] : selected.filter((s) => s !== id))

  // Render logic
  const fields = job.options.fields

  return (
    <ul className="flex flex-col gap-2.5">
      {job.items.map((item) => {
        const s = item.suggestion
        const added = s ? newTags(item.current.tags, s.tags) : []
        const keywords = fields.includes('keywords') ? (item.keywords ?? []) : []
        const ready = item.status === 'ready' && (s !== null || keywords.length > 0)
        return (
          <li
            key={item.id}
            className={`flex flex-col gap-2 rounded-xl border px-3.5 py-3 ${ready && selected.includes(item.id) ? 'border-border-strong bg-card' : 'border-border bg-card'}`}
          >
            <div className="flex items-center gap-2.5">
              {ready ? (
                <Checkbox
                  checked={selected.includes(item.id)}
                  onCheckedChange={(on) => toggle(item.id, on === true)}
                  aria-label={item.title}
                />
              ) : item.status === 'running' ? (
                <Spinner />
              ) : null}
              <span className="min-w-0 flex-1 truncate text-body font-medium text-ink-strong">
                {item.title}
              </span>
              <Badge variant={BADGE[item.status] ?? 'neutral'}>
                {copy.bulk.status[item.status] ?? item.status}
              </Badge>
            </div>
            {item.status === 'failed' ? (
              <p className="text-caption text-destructive">{item.error ?? copy.bulk.failedItem}</p>
            ) : null}
            {(s !== null || keywords.length > 0) && item.status !== 'failed' ? (
              <dl className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-caption">
                {keywords.length > 0 ? (
                  <>
                    <dt className="text-muted-foreground">{keywordCopy.heading}</dt>
                    <dd className="flex flex-wrap gap-1">
                      {keywords.map((k) => (
                        <Badge
                          key={k.keyword}
                          variant={
                            item.current.seoKeywords.includes(k.keyword) ? 'neutral' : 'info'
                          }
                        >
                          {k.primary ? <StarIcon weight="fill" aria-hidden="true" /> : null}
                          {k.keyword}
                        </Badge>
                      ))}
                    </dd>
                  </>
                ) : null}
                {s && fields.includes('seo') ? (
                  <>
                    <dt className="text-muted-foreground">{copy.card.fields.seoTitle}</dt>
                    <dd className="font-medium text-ink-strong">{s.seoTitle}</dd>
                    <dt className="text-muted-foreground">{copy.card.fields.seoDescription}</dt>
                    <dd className="text-foreground">{s.seoDescription}</dd>
                  </>
                ) : null}
                {s && fields.includes('description') ? (
                  <>
                    <dt className="text-muted-foreground">{copy.card.fields.description}</dt>
                    <dd className="line-clamp-3 text-foreground">{s.intro}</dd>
                  </>
                ) : null}
                {fields.includes('tags') && added.length ? (
                  <>
                    <dt className="text-muted-foreground">{copy.bulk.fields.tags}</dt>
                    <dd className="flex flex-wrap gap-1">
                      {added.map((tag) => (
                        <Badge key={tag} variant="neutral">
                          +{tag}
                        </Badge>
                      ))}
                    </dd>
                  </>
                ) : null}
                {s && fields.includes('altText') && s.altTexts.length ? (
                  <>
                    <dt className="text-muted-foreground">{copy.bulk.fields.altText}</dt>
                    <dd className="text-foreground">{s.altTexts.join(' · ')}</dd>
                  </>
                ) : null}
              </dl>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
