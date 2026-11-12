'use client'

import type { AnswerSnapshot } from '@commerce/api'
import { Bookmark, CircleAlert } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card } from '@commerce/ui/shadcn/card'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import DataCard from '@/components/layout/data-card'
import PageHeader from '@/components/layout/page-header'
import { analyticsContent } from '@/data/analytics'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { ANSWER_SLUG, answerReport, stashedAnswer } from '@/lib/answer-report'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import { useStorageScope } from '@/lib/storage-scope'
import ReportChart from './report-chart'
import ReportNameDialog from './report-name-dialog'
import ReportTable from './report-table'

export type SavedAnswer = { id: string; name: string; snapshot: AnswerSnapshot }

type AnswerReportViewProps = {
  /** A saved answer (`?saved=`); null for the one the assistant just handed over. */
  saved: SavedAnswer | null
}

/**
 * An AI answer's table opened as a report (#102) when it cannot be written as a custom query:
 * the chart and table as the AI read them, a plain note that the numbers do not update, and
 * Save report through the usual saved-report flow (filed as a snapshot).
 */
export default function AnswerReportView({ saved: initialSaved }: AnswerReportViewProps) {
  // Hooks
  const storageScope = useStorageScope()
  const c = useCopy(analyticsContent.reports)
  const fmt = useFormat()
  const router = useRouter()
  const [saved, setSaved] = useState(initialSaved)
  /* undefined: the handed-over answer is not read yet (sessionStorage is browser-only). */
  const [handed, setHanded] = useState<AnswerSnapshot | null | undefined>(
    initialSaved ? null : undefined,
  )
  const [naming, setNaming] = useState(false)

  useEffect(() => {
    if (initialSaved) return
    setHanded(stashedAnswer(storageScope))
  }, [initialSaved, storageScope])

  // Event handlers
  const handleSave = async (name: string) => {
    const snapshot = saved?.snapshot ?? handed
    if (!snapshot) return
    try {
      const row = await api.analytics.saveReport({
        name,
        reportSlug: ANSWER_SLUG,
        range: snapshot.range
          ? { key: 'custom', from: snapshot.range.from, to: snapshot.range.to }
          : { key: 'today' },
        snapshot,
      })
      if (!row) return
      setSaved({ id: row.id, name: row.name, snapshot })
      setNaming(false)
      toast.success(c.save.saved)
      router.replace(`${routes.analytics.answer()}?saved=${row.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    }
  }

  // Early returns
  const snapshot = saved?.snapshot ?? handed
  if (snapshot === undefined) return null
  if (!snapshot) {
    return (
      <div className="flex w-full flex-col gap-6 px-4 pt-4 pb-6 md:px-8 md:pt-5 md:pb-8">
        <PageHeader
          title={c.answer.title}
          back={{ label: c.back, href: routes.analytics.reports() }}
        />
        <p className="rounded-xl border border-border border-dashed px-5 py-6 text-body text-muted-foreground">
          {c.answer.empty}
        </p>
      </div>
    )
  }

  // Render logic
  const title = saved?.name ?? c.answer.title
  const { report, result } = answerReport(snapshot, title)

  return (
    <div className="flex w-full flex-col gap-6 px-4 pt-4 pb-6 md:px-8 md:pt-5 md:pb-8">
      <PageHeader
        title={title}
        summary={snapshot.question ? c.answer.asked(snapshot.question) : undefined}
        back={{ label: c.back, href: routes.analytics.reports() }}
        actions={
          saved ? null : (
            <Button onClick={() => setNaming(true)}>
              <Bookmark aria-hidden />
              {c.save.button}
            </Button>
          )
        }
      />
      <Card gap="none" inset={5}>
        <p className="flex items-start gap-2 text-caption text-muted-foreground">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {c.answer.snapshot(fmt.day(snapshot.answeredAt))}
        </p>
      </Card>
      {snapshot.chart ? <ReportChart report={report} data={result} /> : null}
      <DataCard title={c.details}>
        <ReportTable report={report} data={result} />
      </DataCard>
      {naming ? (
        <ReportNameDialog
          title={c.save.title}
          description={c.answer.saveHelp}
          confirm={c.save.confirm}
          initialName={c.answer.title}
          onCancel={() => setNaming(false)}
          onConfirm={handleSave}
        />
      ) : null}
    </div>
  )
}
