'use client'

import type { AutopilotView } from '@commerce/api'
import { Sparkle } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import { toast } from 'sonner'
import DataCard from '@/components/layout/data-card'
import EmptyState from '@/components/layout/empty-state'
import { growthAutopilotContent } from '@/data/growth-home'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { errorText } from '@/lib/api-errors'
import AutopilotProposalRow from './autopilot-proposal-row'

type AutopilotProposalsCardProps = {
  view: AutopilotView
  onChange: (next: AutopilotView) => void
}

const waitingCount = (v: AutopilotView) => v.proposals.filter((p) => p.status === 'proposed').length

/** "Plan campaigns" and the proposals it made, each waiting for approve or dismiss. */
export default function AutopilotProposalsCard({ view, onChange }: AutopilotProposalsCardProps) {
  // Hooks
  const copy = useCopy(growthAutopilotContent)
  const fmt = useFormat()
  const [planning, setPlanning] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  // Helpers
  const run = async (id: string, work: () => Promise<AutopilotView>, done: string) => {
    setBusy(id)
    try {
      onChange(await work())
      toast.success(done)
    } catch (err) {
      toast.error(errorText(err, copy.failed))
    } finally {
      setBusy(null)
    }
  }

  // Event handlers
  const handlePlan = async () => {
    setPlanning(true)
    try {
      const next = await api.marketing.autopilot.plan()
      onChange(next)
      toast.success(copy.proposals.planned(Math.max(0, waitingCount(next) - waitingCount(view))))
    } catch (err) {
      toast.error(errorText(err, copy.failed))
    } finally {
      setPlanning(false)
    }
  }

  // Render logic
  const p = copy.proposals
  const enabled = view.settings.enabled
  const subtitle = view.plannedAt
    ? `${p.subtitle} ${p.lastPlanned}: ${fmt.dateTime(view.plannedAt)}.`
    : p.subtitle

  return (
    <DataCard
      title={p.title}
      subtitle={subtitle}
      action={
        <Button
          loading={planning}
          disabled={!enabled || planning}
          onClick={() => void handlePlan()}
        >
          <Sparkle aria-hidden />
          {p.plan}
        </Button>
      }
    >
      {view.proposals.length === 0 ? (
        <EmptyState variant="inline" body={enabled ? p.empty : p.offHint} />
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {view.proposals.map((proposal) => (
            <AutopilotProposalRow
              key={proposal.id}
              proposal={proposal}
              busy={busy !== null}
              approving={busy === `approve:${proposal.id}`}
              dismissing={busy === `dismiss:${proposal.id}`}
              onApprove={() =>
                void run(
                  `approve:${proposal.id}`,
                  () => api.marketing.autopilot.approve({ id: proposal.id }),
                  proposal.kind === 'automation' ? p.automationOn : p.approved,
                )
              }
              onDismiss={() =>
                void run(
                  `dismiss:${proposal.id}`,
                  () => api.marketing.autopilot.dismiss({ id: proposal.id }),
                  p.dismissed,
                )
              }
            />
          ))}
        </ul>
      )}
    </DataCard>
  )
}
