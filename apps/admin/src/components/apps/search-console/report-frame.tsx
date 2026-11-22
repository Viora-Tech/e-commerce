'use client'

import { SEARCH_CONSOLE_APP_ID } from '@commerce/core/search-console'
import { CircleAlert, RefreshCw, Search } from '@commerce/ui/icons'
import { Alert, AlertDescription } from '@commerce/ui/shadcn/alert'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { type ReactNode, useState } from 'react'
import { toast } from 'sonner'
import LoadFailedState from '@/components/apps/shared/load-failed-state'
import DataCardSkeleton from '@/components/layout/data-card-skeleton'
import EmptyState from '@/components/layout/empty-state'
import PageHeader from '@/components/layout/page-header'
import PageHeaderSkeleton from '@/components/layout/page-header-skeleton'
import { searchConsoleContent } from '@/data/search-console'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { type SearchConsoleReady, useSearchConsoleReport } from '@/hooks/use-search-console-report'
import { api } from '@/lib/api-client'
import { errorText } from '@/lib/api-errors'
import { routes } from '@/lib/routes'

type ReportFrameProps = {
  title: string
  summary: string
  /** The page's body once Google's numbers are stored. */
  children: (report: SearchConsoleReady) => ReactNode
}

/**
 * Shared frame of the app's report pages: the header with "Refresh now" and when the numbers
 * were last updated, and the not-connected, no-property and waiting states, so each page only
 * draws its own part of the report.
 */
export default function ReportFrame({ title, summary, children }: ReportFrameProps) {
  // Hooks
  const copy = useCopy(searchConsoleContent)
  const fmt = useFormat()
  const { report, failed, reload } = useSearchConsoleReport()
  const [refreshing, setRefreshing] = useState(false)

  // Event handlers
  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      const view = await api.searchConsole.refresh()
      if (view.lastError) toast.error(view.lastError)
      else toast.success(copy.refreshed)
      reload()
    } catch (err) {
      toast.error(errorText(err, copy.failed))
    } finally {
      setRefreshing(false)
    }
  }

  // Early returns
  if (failed) {
    return (
      <LoadFailedState
        size="page"
        heading={copy.loadFailed.title}
        body={copy.loadFailed.body}
        onRetry={reload}
      />
    )
  }
  if (!report) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeaderSkeleton actions={1} />
        <DataCardSkeleton fields={0} lines={3} />
        <DataCardSkeleton fields={0} lines={5} />
      </div>
    )
  }
  if (report.state === 'not-installed') return null
  if (report.state === 'not-connected' || report.state === 'no-property') {
    const empty =
      report.state === 'no-property'
        ? copy.states.noProperty
        : report.available
          ? copy.states.notConnected
          : { ...copy.states.unavailable, action: null }
    return (
      <EmptyState
        variant="page"
        heading={empty.title}
        body={empty.body}
        icon={Search}
        action={
          empty.action ? (
            <Button
              nativeButton={false}
              render={<Link href={routes.apps.settings(SEARCH_CONSOLE_APP_ID)} />}
            >
              {empty.action}
            </Button>
          ) : undefined
        }
      />
    )
  }

  // Render logic
  const ready = report.state === 'ready' ? report : null
  const syncedAt = ready?.view.syncedAt ?? null
  const refreshAfter = ready?.view.refreshAfter ?? null
  const reconnect = report.state === 'ready' ? report.view.reconnect : report.reconnect
  const lastError = report.state === 'ready' ? '' : report.lastError

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={title}
        summary={summary}
        actions={
          <Button
            variant="outline"
            loading={refreshing}
            disabled={refreshing || refreshAfter !== null}
            onClick={() => void handleRefresh()}
          >
            <RefreshCw aria-hidden="true" />
            {copy.refresh}
          </Button>
        }
      />
      <p className="text-caption text-muted-foreground">
        {copy.period}
        {syncedAt ? ` · ${copy.synced(fmt.when(syncedAt))}` : null}
        {refreshAfter ? ` · ${copy.refreshWait(fmt.when(refreshAfter))}` : null}
      </p>
      {reconnect ? (
        <Alert tone="danger">
          <CircleAlert />
          <AlertDescription>{copy.states.reconnect}</AlertDescription>
        </Alert>
      ) : null}
      {ready ? (
        children(ready)
      ) : (
        <EmptyState
          variant="page"
          heading={copy.states.pending.title}
          body={lastError || copy.states.pending.body}
          icon={Search}
        />
      )}
    </div>
  )
}
