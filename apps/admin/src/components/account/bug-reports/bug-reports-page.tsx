'use client'

import type { BugReportView } from '@commerce/core/bug-reports'
import { BugIcon } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card } from '@commerce/ui/shadcn/card'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { useState } from 'react'
import EmptyState from '@/components/layout/empty-state'
import PageHeader from '@/components/layout/page-header'
import PillTabs from '@/components/layout/pill-tabs'
import PageState from '@/components/states/page-state'
import { myBugReportsContent } from '@/data/bug-report'
import { useCopy } from '@/hooks/use-copy'
import { useLoad } from '@/hooks/use-load'
import { api } from '@/lib/api-client'
import { announceBugReportsSeen, openBugReport } from '@/lib/bug-report-events'
import BugReportRow from './bug-report-row'

type Scope = 'mine' | 'store'

const SKELETON_ROWS = ['first', 'second', 'third'] as const

/**
 * Account → My reports: the bugs the member reported from this store, newest first, each with
 * its status, the team's latest reply and the screenshot. Opening it marks them seen (the
 * account menu's dot clears). The owner can switch to every report filed in the store.
 */
export default function BugReportsPage() {
  // Hooks
  const copy = useCopy(myBugReportsContent)
  const [scope, setScope] = useState<Scope>('mine')
  const { data, failed, loading, retry } = useLoad(async () => {
    const r = await api.bugReports.list({ scope })
    if (r.reports.some((x) => x.unread)) {
      await api.bugReports.markSeen()
      announceBugReportsSeen()
    }
    return r
  }, [scope])

  // Render logic
  const reports: BugReportView[] | null = loading ? null : (data?.reports ?? null)
  const canSeeStore = data?.canSeeStore ?? false

  // Early returns
  if (failed) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={copy.title} />
        <PageState kind="error" heading={copy.loadFailed} onRetry={retry} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={copy.title}
        subtitle={copy.intro}
        actions={
          <Button variant="outline" onClick={openBugReport}>
            <BugIcon aria-hidden="true" />
            {copy.reportBug}
          </Button>
        }
      />
      {canSeeStore ? (
        <PillTabs
          variant="segmented"
          className="self-start"
          tabs={[
            { value: 'mine' as const, label: copy.scope.mine },
            { value: 'store' as const, label: copy.scope.store },
          ]}
          value={scope}
          onChange={setScope}
        />
      ) : null}
      {reports !== null && reports.length === 0 ? (
        <EmptyState
          variant="page"
          icon={BugIcon}
          heading={copy.empty.title}
          body={copy.empty.body}
        />
      ) : (
        <Card gap="none" inset={6}>
          {reports === null ? (
            <div className="flex flex-col gap-4">
              {SKELETON_ROWS.map((row) => (
                <Skeleton key={row} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {reports.map((r) => (
                <BugReportRow key={r.id} report={r} showReporter={scope === 'store'} />
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  )
}
