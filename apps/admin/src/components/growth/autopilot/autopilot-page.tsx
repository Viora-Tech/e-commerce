'use client'

import type { AutopilotView, MarketingKpi } from '@commerce/api'
import { Button } from '@commerce/ui/shadcn/button'
import { Label } from '@commerce/ui/shadcn/label'
import { Switch } from '@commerce/ui/shadcn/switch'
import { useState } from 'react'
import { toast } from 'sonner'
import PageBody from '@/components/layout/page-body'
import PageHeader from '@/components/layout/page-header'
import { AUTOPILOT_DOCS_URL, growthAutopilotContent } from '@/data/growth-home'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import AttributedSalesCard from '../overview/attributed-sales-card'
import AdChannelsCard from './ad-channels-card'
import AutopilotProposalsCard from './autopilot-proposals-card'
import AutopilotSettingsCard from './autopilot-settings-card'

type AutopilotPageProps = {
  initial: AutopilotView
  /** Sales attributed to marketing over the last 30 days, against the 30 before. */
  results: {
    attributed: MarketingKpi | undefined
    total: MarketingKpi | undefined
    days: string[]
  }
}

/**
 * Growth > Autopilot: switch it on, choose goals and caps, plan campaigns and approve or
 * dismiss each proposal, with what marketing brought in over the last 30 days. Ad channels
 * are listed for when their apps arrive.
 */
export default function AutopilotPage({ initial, results }: AutopilotPageProps) {
  // Hooks
  const copy = useCopy(growthAutopilotContent)
  const [view, setView] = useState(initial)
  const [toggling, setToggling] = useState(false)

  // Event handlers
  const handleToggle = async (on: boolean) => {
    setToggling(true)
    try {
      setView(await api.marketing.autopilot.saveSettings({ ...view.settings, enabled: on }))
      toast.success(on ? copy.status.turnedOn : copy.status.turnedOff)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setToggling(false)
    }
  }

  // Render logic
  const enabled = view.settings.enabled

  return (
    <PageBody className="gap-6 md:pt-5 md:pb-8">
      <PageHeader
        title={copy.title}
        summary={copy.summary}
        back={{ label: copy.back, href: routes.growth.home() }}
        actions={
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              render={<a href={AUTOPILOT_DOCS_URL} target="_blank" rel="noreferrer" />}
              nativeButton={false}
            >
              {copy.learnMore}
            </Button>
            <Label className="flex items-center gap-2 font-normal">
              <Switch
                checked={enabled}
                disabled={toggling}
                onCheckedChange={(on) => void handleToggle(on)}
              />
              {copy.status.toggle}: {enabled ? copy.status.on : copy.status.off}
            </Label>
          </div>
        }
      />
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <AutopilotProposalsCard view={view} onChange={setView} />
        <div className="flex flex-col gap-6">
          <AttributedSalesCard
            attributed={results.attributed}
            total={results.total}
            days={results.days}
          />
          <AutopilotSettingsCard settings={view.settings} onSaved={setView} />
          <AdChannelsCard />
        </div>
      </div>
    </PageBody>
  )
}
