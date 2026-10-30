'use client'

import type { QuestionStatus } from '@commerce/plugin-reviews/schema'
import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@commerce/ui/shadcn/tabs'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/layout/page-header'
import { reviewToolsContent } from '@/data/review-tools'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import QuestionCard from './question-card'

type Page = Awaited<ReturnType<typeof api.reviews.questions.list>>

/** The tabs: waiting for an answer first, the moderation statuses after. */
const TABS = ['unanswered', 'pending', 'published', 'hidden'] as const
type Tab = (typeof TABS)[number]

const PER_PAGE = 20

/** The list query for a tab. */
function tabInput(tab: Tab): { status?: QuestionStatus; unanswered?: boolean } {
  return tab === 'unanswered' ? { unanswered: true } : { status: tab }
}

/**
 * Apps › Reviews › Questions: what shoppers asked on product pages. Answer and publish, hide or
 * delete; only published questions with an answer show on the store.
 */
export default function QuestionsPage() {
  // Hooks
  const { questions: copy } = useCopy(reviewToolsContent)
  const [tab, setTab] = useState<Tab>('unanswered')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<Page | null>(null)
  const [version, setVersion] = useState(0)
  useEffect(() => {
    let live = true
    api.reviews.questions
      .list({ ...tabInput(tab), q: query.trim() || undefined, page, perPage: PER_PAGE })
      .then((r) => live && setResult(r))
      .catch((err: unknown) =>
        toast.error(err instanceof Error ? err.message : reviewToolsContent.questions.failed),
      )
    return () => {
      live = false
    }
  }, [tab, query, page, version])

  // Event handlers
  const handleTab = (value: string) => {
    setTab(value as Tab)
    setPage(1)
  }
  const handleChanged = () => setVersion((v) => v + 1)

  // Render logic
  const counts = result
    ? { unanswered: result.unanswered, ...result.counts }
    : { unanswered: 0, pending: 0, published: 0, hidden: 0 }
  const pages = result ? Math.max(1, Math.ceil(result.total / PER_PAGE)) : 1

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={copy.title}
        subtitle={copy.subtitle}
        back={{ label: copy.back, href: routes.apps.page('reviews') }}
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={tab} onValueChange={handleTab}>
          <TabsList>
            {TABS.map((t) => (
              <TabsTrigger key={t} value={t}>
                {copy.tabs[t]} ({counts[t]})
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Input
          type="search"
          className="sm:max-w-xs"
          placeholder={copy.search}
          aria-label={copy.search}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setPage(1)
          }}
        />
      </div>
      {!result ? (
        <Skeleton className="h-64 w-full rounded-lg" />
      ) : result.rows.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-body-strong">{copy.empty.heading}</p>
          <p className="text-body text-muted-foreground">{copy.empty.body}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {result.rows.map((q) => (
            <QuestionCard key={q.id} question={q} onChanged={handleChanged} />
          ))}
        </div>
      )}
      {pages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            {copy.previous}
          </Button>
          <span className="text-caption text-muted-foreground">{copy.pageOf(page, pages)}</span>
          <Button variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            {copy.next}
          </Button>
        </div>
      )}
    </div>
  )
}
