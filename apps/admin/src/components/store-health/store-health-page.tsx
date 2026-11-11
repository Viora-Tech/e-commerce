'use client'

import { HEALTH_SEVERITIES, type StoreHealthReport } from '@commerce/core/store-health'
import { CheckIcon } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/layout/page-header'
import StatusChip from '@/components/layout/status-chip'
import SettingsCard from '@/components/settings/settings-card'
import { storeHealthContent } from '@/data/store-health'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { SEVERITY_TONE } from '@/lib/store-health'
import HealthIssueRow from './health-issue-row'

type StoreHealthPageProps = {
  /** The server's first check; null when it failed. */
  initial: StoreHealthReport | null
}

/** Settings → Store health: one card per severity, worst first, each problem with its fix link. */
export default function StoreHealthPage({ initial }: StoreHealthPageProps) {
  // Hooks
  const copy = useCopy(storeHealthContent)
  const fmt = useFormat()
  const [report, setReport] = useState(initial)
  const [checking, setChecking] = useState(false)

  // Event handlers
  const handleRecheck = async () => {
    setChecking(true)
    try {
      setReport(await api.store.health())
    } catch {
      toast.error(copy.loadFailed)
    } finally {
      setChecking(false)
    }
  }

  // Render logic
  const recheck = (
    <Button variant="outline" size="sm" onClick={handleRecheck} disabled={checking}>
      {copy.recheck}
    </Button>
  )
  const groups = HEALTH_SEVERITIES.map((severity) => ({
    severity,
    issues: report?.issues.filter((i) => i.severity === severity) ?? [],
  })).filter((g) => g.issues.length > 0)

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={copy.title}
        subtitle={
          report ? (
            <span className="flex flex-col gap-0.5">
              <span>{copy.intro}</span>
              <span>{copy.checked(fmt.dateTime(report.checkedAt))}</span>
            </span>
          ) : (
            copy.intro
          )
        }
        actions={recheck}
      />
      {report === null ? (
        <SettingsCard>
          <p className="text-body text-danger">{copy.loadFailed}</p>
        </SettingsCard>
      ) : groups.length === 0 ? (
        <SettingsCard>
          <div className="flex items-start gap-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full key-primary">
              <CheckIcon className="size-4" aria-hidden="true" />
            </span>
            <div className="flex flex-col gap-0.5">
              <p className="text-body font-semibold text-ink-strong">{copy.allGood.title}</p>
              <p className="text-caption text-muted-foreground">{copy.allGood.body}</p>
            </div>
          </div>
        </SettingsCard>
      ) : (
        groups.map((g) => (
          <SettingsCard key={g.severity}>
            <header className="mb-4 flex flex-wrap items-center gap-2">
              <StatusChip tone={SEVERITY_TONE[g.severity]}>
                {copy.severity[g.severity]} · {g.issues.length}
              </StatusChip>
              <span className="text-caption text-muted-foreground">
                {copy.severityHelp[g.severity]}
              </span>
            </header>
            <ul className="flex flex-col">
              {g.issues.map((issue) => (
                <HealthIssueRow key={issue.key} issue={issue} copy={copy} />
              ))}
            </ul>
          </SettingsCard>
        ))
      )}
    </div>
  )
}
