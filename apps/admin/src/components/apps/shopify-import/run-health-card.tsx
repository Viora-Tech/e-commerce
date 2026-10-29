'use client'

import type { StoreHealthReport } from '@commerce/core/store-health'
import { ArrowRight } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { buttonVariants } from '@commerce/ui/shadcn/button'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import SettingsCard from '@/components/settings/settings-card'
import HealthIssueRow from '@/components/store-health/health-issue-row'
import { storeHealthContent } from '@/data/store-health'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'

/** How many problems the summary lists before "N more things to fix". */
const SHOWN = 5

/**
 * The import summary's "Store health after this import": the same check as Settings → Store
 * health, run as soon as the import finishes, so a setup the import left broken (zones with no
 * rates, Waimers 2026-10-21) is seen before shoppers hit it. Hidden when the member cannot read
 * settings or the check fails. The run page keys it by the run's finish, so a retry checks again.
 */
export default function RunHealthCard() {
  // Hooks
  const copy = useCopy(storeHealthContent)
  const [report, setReport] = useState<StoreHealthReport | null | undefined>(undefined)

  useEffect(() => {
    let live = true
    api.store
      .health()
      .then((r) => live && setReport(r))
      .catch(() => live && setReport(null))
    return () => {
      live = false
    }
  }, [])

  // Early returns
  if (report === null) return null

  // Render logic
  const more = report ? report.issues.length - SHOWN : 0
  const open = (
    <Link
      href={routes.settings.storeHealth()}
      className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
    >
      {copy.importSummary.open}
      <ArrowRight className="size-3.5" aria-hidden="true" />
    </Link>
  )

  return (
    <SettingsCard
      title={copy.importSummary.title}
      description={copy.importSummary.intro}
      footer={report && report.issues.length > 0 ? open : undefined}
    >
      {report === undefined ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : report.issues.length === 0 ? (
        <p className="text-body text-muted-foreground">{copy.importSummary.allGood}</p>
      ) : (
        <>
          <ul className="flex flex-col">
            {report.issues.slice(0, SHOWN).map((issue) => (
              <HealthIssueRow key={issue.key} issue={issue} copy={copy} showSeverity />
            ))}
          </ul>
          {more > 0 ? (
            <p className="mt-3 text-caption text-muted-foreground">
              {copy.importSummary.more(more)}
            </p>
          ) : null}
        </>
      )}
    </SettingsCard>
  )
}
