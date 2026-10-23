'use client'

import type { AutomationUsage } from '@commerce/core/automations'
import { Card } from '@commerce/ui/shadcn/card'
import { useEffect, useState } from 'react'
import SectionHead from '@/components/layout/section-head'
import { automationsContent } from '@/data/automations'
import { useCopy } from '@/hooks/use-copy'
import { automationApi } from '@/lib/automation-api'
import UsageMeter from './usage-meter'

/** Automations settings: plan usage, how approvals and run history work, and where HTTP secrets go. */
export default function SettingsPage() {
  // Hooks
  const all = useCopy(automationsContent)
  const [usage, setUsage] = useState<AutomationUsage | null>(null)

  useEffect(() => {
    let live = true
    automationApi
      .usage()
      .then((u) => live && setUsage(u))
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [])

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
      {usage ? <UsageMeter usage={usage} /> : null}
      {sections.map((s) => (
        <Card key={s.title} gap={3} inset={4}>
          <h3 className="text-card-title text-ink-strong">{s.title}</h3>
          <p className="text-body text-muted-foreground">{s.body}</p>
        </Card>
      ))}
    </div>
  )
}
