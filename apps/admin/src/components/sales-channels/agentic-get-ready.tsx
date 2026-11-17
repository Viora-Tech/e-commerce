'use client'

import type { AgenticOverview } from '@commerce/core'
import { AI_AGENTS } from '@commerce/core/sales-channels'
import { ChevronRight, CircleCheck, SlidersHorizontal } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { Switch } from '@commerce/ui/shadcn/switch'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import DataCard from '@/components/layout/data-card'
import PageBody from '@/components/layout/page-body'
import PageColumns from '@/components/layout/page-columns'
import PageHeader from '@/components/layout/page-header'
import { agentReadyContent } from '@/data/agent-knowledge'
import { salesChannelsContent } from '@/data/sales-channels'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { agentChipStatus } from '@/lib/channel-status'
import { routes } from '@/lib/routes'
import AgentTestQuery from './agent-test-query'
import ChannelLogo from './channel-logo'
import ChannelStatusChip from './channel-status-chip'

type AgenticGetReadyProps = {
  data: AgenticOverview
  /** Knowledge base counts; null when they could not be read. */
  knowledge: { published: number; total: number } | null
}

/** A catalog scoring this or more reads as ready for AI agents. */
const READY_SCORE = 80

/** What every agent needs to sell; marketing email stays opt-in (Controls). */
const SHARES = ['catalog', 'prices', 'policies', 'orders'] as const

/**
 * Agentic sales before any agent is live, after Shopify's Agentic page: a short "get ready"
 * checklist on the left, and on the right one switch that lets Koomerce list the store with
 * every agent as each goes live, the agents with their state, and what they read from.
 */
export default function AgenticGetReady({ data, knowledge }: AgenticGetReadyProps) {
  // Hooks
  const router = useRouter()
  const copy = useCopy(salesChannelsContent.getReady)
  const ready = useCopy(agentReadyContent)
  const shared = useCopy(salesChannelsContent)
  const format = useFormat()
  const [busy, setBusy] = useState(false)

  // Event handlers
  /** On asks for every agent not yet asked for; off withdraws every waiting request. */
  const handleManage = async (on: boolean) => {
    setBusy(true)
    try {
      for (const row of data.agents) {
        if (on && row.state.status === 'not_connected')
          await api.salesChannels.connect({
            channel: row.agent,
            shares: [...SHARES],
            account: null,
            catalog: 'all',
          })
        if (!on && row.state.status === 'requested')
          await api.salesChannels.cancel({ channel: row.agent })
      }
      toast.success(on ? copy.managedOn : copy.managedOff)
      router.refresh()
    } catch {
      toast.error(shared.connect.failed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const managed = data.agents.some((a) => a.state.status !== 'not_connected')
  const { products, readiness } = data
  const steps = [
    {
      id: 'catalog',
      done: readiness.score >= READY_SCORE,
      title: copy.steps.catalog.title,
      body: copy.steps.catalog.body(readiness.score, readiness.issues),
      href: routes.salesChannels.agenticReadiness(),
    },
    {
      id: 'visible',
      done: products.visible > 0,
      title: copy.steps.visible.title,
      body: copy.steps.visible.body(products.visible, products.active),
      href: routes.salesChannels.agenticControls(),
    },
    ...(knowledge
      ? [
          {
            id: 'knowledge',
            done: knowledge.published > 0,
            title: ready.step.title,
            body: ready.step.body(knowledge.published, knowledge.total),
            href: routes.salesChannels.agenticKnowledge(),
          },
        ]
      : []),
  ]

  return (
    <PageBody>
      <PageHeader
        title={shared.overview.title}
        subtitle={shared.overview.subtitle}
        actions={
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={routes.salesChannels.agenticControls()} />}
          >
            <SlidersHorizontal />
            {shared.overview.controls}
          </Button>
        }
      />
      <PageColumns
        main={
          <>
            <h2 className="max-w-[34rem] text-balance text-2xl font-semibold tracking-tight text-ink-strong">
              {copy.headline}
            </h2>
            <DataCard title={copy.stepsHeading} flush>
              <ul className="flex flex-col divide-y divide-border border-t border-border">
                {steps.map((step) => (
                  <li key={step.id}>
                    <Link
                      href={step.href}
                      className="group flex items-center gap-3 px-5 py-3 transition-colors duration-150 hover:bg-row-hover focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:outline-none focus-visible:ring-inset motion-reduce:transition-none"
                    >
                      {step.done ? (
                        <CircleCheck
                          aria-label={copy.done}
                          className="size-5 shrink-0 text-success"
                        />
                      ) : (
                        <span
                          role="img"
                          aria-label={copy.todo}
                          className="size-5 shrink-0 rounded-full border-2 border-dashed border-muted-foreground/50"
                        />
                      )}
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="text-body font-medium text-foreground">{step.title}</span>
                        <span className="text-caption text-muted-foreground">{step.body}</span>
                      </span>
                      <ChevronRight
                        aria-hidden
                        className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </DataCard>
            <AgentTestQuery />
            <p className="text-caption text-muted-foreground">{copy.note}</p>
          </>
        }
        side={
          <>
            <DataCard title={copy.channelsHeading}>
              <div className="flex items-center justify-between gap-3 text-body font-medium text-foreground">
                <span id="agentic-manage">{copy.manage}</span>
                <Switch
                  checked={managed}
                  disabled={busy}
                  onCheckedChange={handleManage}
                  aria-labelledby="agentic-manage"
                />
              </div>
              <p className="mt-1 text-caption text-muted-foreground">{copy.manageBody}</p>
              <ul className="mt-4 flex flex-col gap-3 border-t border-border pt-4">
                {AI_AGENTS.map((agent) => {
                  const state = data.agents.find((a) => a.agent === agent)?.state
                  return (
                    <li key={agent} className="flex items-center gap-2.5">
                      <ChannelLogo channel={agent} size="sm" />
                      <span className="min-w-0 flex-1 truncate text-body text-foreground">
                        {shared.agents[agent].name}
                      </span>
                      {state ? <ChannelStatusChip status={agentChipStatus(state)} /> : null}
                    </li>
                  )
                })}
              </ul>
            </DataCard>
            <DataCard title={copy.sourcesHeading}>
              <dl className="flex flex-col gap-2.5 text-body">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-foreground">{copy.sources.catalog}</dt>
                  <dd className="text-muted-foreground tabular-nums">
                    {copy.sources.products(format.number(products.visible))}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-foreground">{copy.sources.score}</dt>
                  <dd
                    className={cn(
                      'tabular-nums',
                      readiness.score >= READY_SCORE ? 'text-success' : 'text-muted-foreground',
                    )}
                  >
                    {readiness.score}/100
                  </dd>
                </div>
                {knowledge ? (
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-foreground">
                      <Link
                        href={routes.salesChannels.agenticKnowledge()}
                        className="hover:underline"
                      >
                        {ready.sources.knowledge}
                      </Link>
                    </dt>
                    <dd className="text-muted-foreground tabular-nums">
                      {ready.sources.knowledgeCount(knowledge.published, knowledge.total)}
                    </dd>
                  </div>
                ) : null}
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-foreground">{ready.sources.endpoint}</dt>
                  <dd className="font-mono text-caption text-muted-foreground">
                    {ready.sources.endpointValue}
                  </dd>
                </div>
              </dl>
            </DataCard>
          </>
        }
      />
    </PageBody>
  )
}
