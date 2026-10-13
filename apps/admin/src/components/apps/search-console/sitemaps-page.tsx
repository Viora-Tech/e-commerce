'use client'

import { SEARCH_CONSOLE_APP_ID } from '@commerce/core/search-console'
import { CircleAlert, ListTree } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card } from '@commerce/ui/shadcn/card'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import DataCard from '@/components/layout/data-card'
import EmptyState from '@/components/layout/empty-state'
import ProoflyPageHeader from '@/components/layout/proofly-page-header'
import StatusChip from '@/components/layout/status-chip'
import { searchConsoleContent } from '@/data/search-console'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'

type Sitemaps = Awaited<ReturnType<typeof api.searchConsole.sitemaps>>

const errorText = (fallback: string, err: unknown) =>
  err instanceof Error && err.message ? err.message : fallback

/**
 * The property's sitemaps as Google lists them (read live from Search Console) and a button to
 * send the store's own `/sitemap.xml`.
 */
export default function SitemapsPage() {
  // Hooks
  const copy = useCopy(searchConsoleContent)
  const fmt = useFormat()
  const [data, setData] = useState<Sitemaps | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [revision, setRevision] = useState(0)

  // biome-ignore lint/correctness/useExhaustiveDependencies: `revision` re-reads the list after a submit
  useEffect(() => {
    let cancelled = false
    api.searchConsole
      .sitemaps()
      .then((d) => {
        if (cancelled) return
        setData(d)
        setError(null)
      })
      .catch((err) => !cancelled && setError(errorText(copy.sitemaps.loadFailed, err)))
    return () => {
      cancelled = true
    }
  }, [revision])

  // Event handlers
  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      await api.searchConsole.submitSitemap()
      toast.success(copy.sitemaps.submitted)
      setRevision((n) => n + 1)
    } catch (err) {
      toast.error(errorText(copy.failed, err))
    } finally {
      setSubmitting(false)
    }
  }

  // Early returns
  if (error) {
    return (
      <Card>
        <EmptyState
          heading={copy.sitemaps.loadFailed}
          body={error}
          icon={CircleAlert}
          action={
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href={routes.apps.settings(SEARCH_CONSOLE_APP_ID)} />}
            >
              {copy.states.notConnected.action}
            </Button>
          }
        />
      </Card>
    )
  }
  if (!data) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  // Render logic
  const known = data.sitemaps.some((s) => s.url === data.ours)

  return (
    <div className="flex flex-col gap-5">
      <ProoflyPageHeader title={copy.sitemaps.title} summary={copy.sitemaps.summary} />
      <DataCard title={copy.sitemaps.ours}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <a
            href={data.ours}
            target="_blank"
            rel="noreferrer"
            className="min-w-0 truncate font-mono text-body text-foreground underline-offset-4 hover:underline"
          >
            {data.ours}
          </a>
          <Button loading={submitting} disabled={submitting} onClick={() => void handleSubmit()}>
            {known ? copy.sitemaps.resubmit : copy.sitemaps.submit}
          </Button>
        </div>
      </DataCard>
      <DataCard title={copy.sitemaps.listTitle}>
        {data.sitemaps.length === 0 ? (
          <EmptyState
            heading={copy.sitemaps.listTitle}
            body={copy.sitemaps.empty}
            icon={ListTree}
          />
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {data.sitemaps.map((s) => (
              <li key={s.url} className="flex flex-col gap-1.5 px-3 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1 truncate font-mono text-body text-foreground">
                    {s.url}
                  </span>
                  {s.pending ? (
                    <StatusChip tone="attention">{copy.sitemaps.pending}</StatusChip>
                  ) : s.errors > 0 || s.warnings > 0 ? (
                    <StatusChip tone="danger">
                      {copy.sitemaps.problems(s.errors, s.warnings)}
                    </StatusChip>
                  ) : (
                    <StatusChip tone="success">{copy.sitemaps.ok}</StatusChip>
                  )}
                </div>
                <p className="text-caption text-muted-foreground">
                  {[
                    s.lastSubmitted ? copy.sitemaps.sent(fmt.when(s.lastSubmitted)) : null,
                    s.lastDownloaded
                      ? copy.sitemaps.read(fmt.when(s.lastDownloaded))
                      : copy.sitemaps.notRead,
                    s.submitted > 0 ? copy.sitemaps.pagesFound(fmt.number(s.submitted)) : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </li>
            ))}
          </ul>
        )}
      </DataCard>
    </div>
  )
}
