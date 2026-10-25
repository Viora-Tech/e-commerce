'use client'

import type { AgenticOverview } from '@commerce/core'
import { AI_AGENTS } from '@commerce/core/sales-channels'
import { ChevronRight, CircleCheck, SlidersHorizontal } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Switch } from '@commerce/ui/shadcn/switch'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import KitButton from '@/components/kit/kit-button'
import DataCard from '@/components/layout/data-card'
import PageBody from '@/components/layout/page-body'
import PageHeader from '@/components/layout/page-header'
import { salesChannelsContent } from '@/data/sales-channels'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { chipStatus } from '@/lib/channel-status'
import { routes } from '@/lib/routes'
import ChannelLogo from './channel-logo'
import ChannelStatusChip from './channel-status-chip'

type AgenticGetReadyProps = { data: AgenticOverview }

/** A catalog scoring this or more reads as ready for AI agents. */
const READY_SCORE = 80

/** What every agent needs to sell; marketing email stays opt-in (Controls). */
const SHARES = ['catalog', 'prices', 'policies', 'orders'] as const

/**
 * Agentic sales before any agent is live, after Shopify's Agentic page: a short "get ready"
 * checklist on the left, and on the right one switch that lets Koomerce list the store with
 * every agent as each goes live, the agents with their state, and what they read from.
 */
export default function AgenticGetReady({ data }: AgenticGetReadyProps) {
  // Hooks
  const router = useRouter()
  const copy = useCopy(salesChannelsContent.getReady)
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
  ]

  return (
    <PageBody className="gap-6 md:pt-5 md:pb-8">
      <PageHeader
        title={shared.overview.title}
        subtitle={shared.overview.subtitle}
        actions={
          <KitButton variant="secondary" href={routes.salesChannels.agenticControls()}>
            <SlidersHorizontal />
            {shared.overview.controls}
          </KitButton>
        }
      />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        <div className="flex flex-col gap-6">
          <h2 className="max-w-[34rem] text-balance text-2xl font-semibold tracking-tight text-ink-strong">
            {copy.headline}
          </h2>
          <section className="flex flex-col gap-3">
            <h3 className="text-body font-semibold text-foreground">{copy.stepsHeading}</h3>
            <ul className="flex flex-col gap-2 rounded-lg border border-border bg-card p-2 shadow-[var(--shadow-card)]">
              {steps.map((step) => (
                <li key={step.id}>
                  <Link
                    href={step.href}
                    className="group flex items-center gap-3 rounded-md px-3 py-3 transition-colors duration-150 hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:outline-none motion-reduce:transition-none"
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
          </section>
          <p className="text-caption text-muted-foreground">{copy.note}</p>
        </div>
        <div className="flex flex-col gap-4 lg:sticky lg:top-4">
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
                    {state ? <ChannelStatusChip status={chipStatus(state)} /> : null}
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
            </dl>
          </DataCard>
        </div>
      </div>
    </PageBody>
  )
}
