'use client'

import {
  AGENT_SHARES,
  type AgentShare,
  AI_AGENTS,
  type AiAgent,
  type ChannelState,
} from '@commerce/core/sales-channels'
import { InfoIcon } from '@commerce/ui/icons'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { useState } from 'react'
import { toast } from 'sonner'
import ChoiceCard from '@/components/layout/choice-card'
import { salesChannelsContent } from '@/data/sales-channels'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import ConnectSteps from './connect-steps'

type ConnectAgentDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The agent the dialog opens on (a card's Connect); null lets the merchant pick. */
  agent: AiAgent | null
  states: Record<AiAgent, ChannelState>
  score: number
  onRequested: () => void
}

/** On by default: what every agent needs to sell. Marketing email stays opt-in. */
const DEFAULT_SHARES: AgentShare[] = ['catalog', 'prices', 'policies', 'orders']

/** Figma "Connect an AI agent": pick the agent, choose what it can see, then ask for access. */
export default function ConnectAgentDialog({
  open,
  onOpenChange,
  agent: initial,
  states,
  score,
  onRequested,
}: ConnectAgentDialogProps) {
  // Hooks
  const copy = useCopy(salesChannelsContent.connect)
  const agents = useCopy(salesChannelsContent.agents)
  const [agent, setAgent] = useState<AiAgent>(
    () => initial ?? AI_AGENTS.find((a) => states[a].status === 'not_connected') ?? 'chatgpt',
  )
  const [at, setAt] = useState(initial ? 1 : 0)
  const [shares, setShares] = useState<AgentShare[]>(DEFAULT_SHARES)
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleShare = (share: AgentShare, on: boolean) =>
    setShares((s) => (on ? [...s, share] : s.filter((x) => x !== share)))

  const handleNext = async () => {
    if (at < 2) {
      setAt(at + 1)
      return
    }
    setBusy(true)
    try {
      await api.salesChannels.connect({ channel: agent, shares, account: null, catalog: 'all' })
      toast.success(copy.requested(agents[agent].name))
      onRequested()
      onOpenChange(false)
    } catch {
      toast.error(copy.failed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const name = agents[agent].name
  return (
    <ConnectSteps
      open={open}
      onOpenChange={onOpenChange}
      title={copy.title}
      intro={copy.intro}
      steps={[copy.steps.agent, copy.steps.shares, copy.steps.review]}
      at={at}
      onBack={() => setAt(at - 1)}
      onNext={handleNext}
      submitLabel={copy.submit}
      busy={busy}
      nextDisabled={at === 1 && !shares.includes('catalog')}
    >
      {at === 0 ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-caption font-medium text-muted-foreground uppercase">
            {copy.agentLabel}
          </legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {AI_AGENTS.map((a) => (
              <ChoiceCard
                key={a}
                layout="row"
                showCheck
                label={agents[a].name}
                description={agents[a].protocol}
                selected={agent === a}
                disabled={states[a].status !== 'not_connected'}
                onSelect={() => setAgent(a)}
              />
            ))}
          </div>
        </fieldset>
      ) : null}
      {at === 1 ? (
        <fieldset className="flex flex-col gap-2.5">
          <legend className="mb-2 text-caption font-medium text-muted-foreground uppercase">
            {copy.sharesLabel(name)}
          </legend>
          {AGENT_SHARES.map((share) => {
            const label = share === 'orders' ? copy.shares.orders(name) : copy.shares[share]
            return (
              <div key={share} className="flex items-center gap-2.5 text-body">
                <Checkbox
                  id={`agent-share-${share}`}
                  checked={shares.includes(share)}
                  onCheckedChange={(v) => handleShare(share, v === true)}
                />
                <label htmlFor={`agent-share-${share}`}>{label}</label>
              </div>
            )
          })}
          <p className="mt-2 flex gap-2 rounded-md border border-border bg-muted/50 p-3 text-caption text-muted-foreground">
            <InfoIcon className="mt-0.5 size-4 shrink-0" />
            {copy.ordersNote(name)}
          </p>
        </fieldset>
      ) : null}
      {at === 2 ? (
        <div className="flex flex-col gap-3 text-body">
          <p>{copy.reviewBody(name)}</p>
          <p className="text-caption text-muted-foreground">{copy.readiness(score)}</p>
        </div>
      ) : null}
    </ConnectSteps>
  )
}
