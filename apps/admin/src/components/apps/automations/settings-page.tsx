'use client'

import { Card } from '@commerce/ui/shadcn/card'
import LoadFailedState from '@/components/apps/shared/load-failed-state'
import DataCardSkeleton from '@/components/layout/data-card-skeleton'
import SectionHead from '@/components/layout/section-head'
import { appsContent } from '@/data/apps'
import { automationsContent } from '@/data/automations'
import { useCopy } from '@/hooks/use-copy'
import { useLoad } from '@/hooks/use-load'
import { automationApi } from '@/lib/automation-api'
import UsageMeter from './usage-meter'

/** Automations settings: plan usage, how approvals and run history work, and where HTTP secrets go. */
export default function SettingsPage() {
  // Hooks
  const apps = useCopy(appsContent)
  const all = useCopy(automationsContent)
  /** Plan usage: a card skeleton while it loads, Try again (or no-access) when it fails. */
  const { data: usage, failed, retry } = useLoad(() => automationApi.usage())

  // Render logic
  const copy = all.settings
  const sections = [
    { title: copy.approvals, body: copy.approvalsBody },
    { title: copy.retention, body: copy.retentionBody },
    { title: copy.secrets, body: copy.secretsBody },
  ]

  return (
    <div className="flex flex-col gap-4">
      <SectionHead title={copy.title} />
      {usage ? (
        <UsageMeter usage={usage} />
      ) : failed ? (
        <LoadFailedState heading={apps.couldNotLoad.usage} failed={failed} onRetry={retry} />
      ) : (
        <DataCardSkeleton fields={0} lines={2} />
      )}
      {sections.map((s) => (
        <Card key={s.title} gap={3} inset={4}>
          <h3 className="text-card-title text-ink-strong">{s.title}</h3>
          <p className="text-body text-muted-foreground">{s.body}</p>
        </Card>
      ))}
    </div>
  )
}
