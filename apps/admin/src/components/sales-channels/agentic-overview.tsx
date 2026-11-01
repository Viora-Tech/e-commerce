'use client'

import type { AgenticOverview } from '@commerce/core'
import {
  AI_AGENTS,
  type AiAgent,
  type ChannelState,
  isLive,
  needsReconnect,
} from '@commerce/core/sales-channels'
import { AgenticSales, PlugConnect, SlidersHorizontal } from '@commerce/ui/icons'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import KitButton from '@/components/kit/kit-button'
import EmptyState from '@/components/layout/empty-state'
import PageBody from '@/components/layout/page-body'
import PageHeader from '@/components/layout/page-header'
import SectionHead from '@/components/layout/section-head'
import StatStrip from '@/components/layout/stat-strip'
import { salesChannelsContent } from '@/data/sales-channels'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'
import { percent } from '@/lib/stats'
import AgentCard from './agent-card'
import AgenticGetReady from './agentic-get-ready'
import ChannelBar from './channel-bar'
import ChannelOrdersCard from './channel-orders-card'
import ConnectAgentDialog from './connect-agent-dialog'
import ManageChannelDialog from './manage-channel-dialog'
import RequestDialog from './request-dialog'
import SyncStatusBar from './sync-status-bar'

type AgenticOverviewPageProps = { data: AgenticOverview }

/** Figma "Agentic sales · Overview" and "· Not connected". */
export default function AgenticOverviewPage({ data }: AgenticOverviewPageProps) {
  // Hooks
  const router = useRouter()
  const copy = useCopy(salesChannelsContent.overview)
  const shared = useCopy(salesChannelsContent)
  const format = useFormat()
  const [connecting, setConnecting] = useState<{ agent: AiAgent | null } | null>(null)
  const [viewing, setViewing] = useState<AiAgent | null>(null)
  const [managing, setManaging] = useState(false)

  // Render logic
  const states = Object.fromEntries(data.agents.map((a) => [a.agent, a.state])) as Record<
    AiAgent,
    ChannelState
  >
  const requested = data.agents.filter((a) => a.state.status === 'requested')
  const viewed = viewing ? states[viewing] : null
  // The bar speaks for the agent that most needs a look: lost access, then a running sync.
  const featured =
    data.agents.find((a) => needsReconnect(a.state)) ??
    data.agents.find((a) => a.state.status === 'syncing' || a.state.status === 'first_sync') ??
    data.agents.find((a) => isLive(a.state))
  const anyActive = data.agents.some((a) => a.state.status !== 'not_connected')
  const { totals, products, readiness } = data

  // Early returns
  // Until an agent is live or needs a look, the page is the short "get ready" checklist.
  if (!featured) return <AgenticGetReady data={data} />

  return (
    <PageBody className="gap-6 md:pt-5 md:pb-8">
      <PageHeader
        title={copy.title}
        subtitle={copy.subtitle}
        actions={
          <>
            <KitButton variant="secondary" href={routes.salesChannels.agenticControls()}>
              <SlidersHorizontal />
              {copy.controls}
            </KitButton>
            <KitButton onClick={() => setConnecting({ agent: null })}>
              <PlugConnect />
              {copy.connect}
            </KitButton>
          </>
        }
      />
      {featured ? (
        <ChannelBar
          state={featured.state}
          name={shared.agents[featured.agent].name}
          onReconnect={() => setConnecting({ agent: featured.agent })}
          onWithdraw={() => setViewing(featured.agent)}
        />
      ) : requested.length > 0 ? (
        <SyncStatusBar
          tone="pending"
          title={shared.bar.requested(requested.map((a) => shared.agents[a.agent].name).join(', '))}
          detail={shared.bar.notConnectedBody}
        />
      ) : null}
      <StatStrip
        tiles={[
          {
            id: 'orders',
            label: copy.stats.orders,
            value: format.number(totals.orders),
            trend: percent(totals.orders, totals.prevOrders),
            trendNote: shared.vsLast,
          },
          {
            id: 'revenue',
            label: copy.stats.revenue,
            value: format.moneyWhole(totals.revenuePaise),
            trend: percent(totals.revenuePaise, totals.prevRevenuePaise),
            trendNote: shared.vsLast,
          },
          {
            id: 'visible',
            label: copy.stats.visible,
            value: format.number(products.visible),
            note: copy.stats.visibleNote(products.active),
          },
          {
            id: 'score',
            label: copy.stats.score,
            value: String(readiness.score),
            note: copy.stats.scoreNote(readiness.issues),
          },
        ]}
      />
      {!anyActive ? (
        <EmptyState
          variant="section"
          className="rounded-lg border border-border bg-card bg-[image:var(--card-surface)] shadow-[var(--shadow-card)]"
          icon={AgenticSales}
          heading={copy.emptyHeading}
          body={copy.emptyBody}
          action={
            <KitButton variant="secondary" onClick={() => setConnecting({ agent: null })}>
              {copy.connect}
            </KitButton>
          }
        />
      ) : null}
      <section className="flex flex-col gap-3">
        <SectionHead title={copy.agentsHeading} intro={copy.agentsIntro} />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {AI_AGENTS.map((agent) => (
            <AgentCard
              key={agent}
              agent={agent}
              state={states[agent]}
              orders={data.agents.find((a) => a.agent === agent)?.orders ?? 0}
              onConnect={() => setConnecting({ agent })}
              onViewRequest={() =>
                agent === 'chatgpt' && isLive(states[agent])
                  ? setManaging(true)
                  : isLive(states[agent])
                    ? router.push(routes.salesChannels.agenticControls())
                    : setViewing(agent)
              }
            />
          ))}
        </div>
      </section>
      <ChannelOrdersCard
        title={copy.recentHeading}
        empty={copy.recentEmpty}
        orders={data.recent}
        showChannel
      />
      {connecting ? (
        <ConnectAgentDialog
          open
          onOpenChange={(open) => {
            if (!open) setConnecting(null)
          }}
          agent={connecting.agent}
          states={states}
          score={readiness.score}
          onRequested={() => router.refresh()}
        />
      ) : null}
      {viewing && viewed ? (
        <RequestDialog
          open
          onOpenChange={(open) => {
            if (!open) setViewing(null)
          }}
          channel={viewing}
          name={shared.agents[viewing].name}
          requestedAt={viewed.requestedAt}
          onWithdrawn={() => router.refresh()}
        />
      ) : null}
      <ManageChannelDialog
        open={managing}
        onOpenChange={setManaging}
        channel="chatgpt"
        name={shared.agents.chatgpt.name}
        state={states.chatgpt}
      />
    </PageBody>
  )
}
