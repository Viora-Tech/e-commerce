'use client'

import type { SocialOverview } from '@commerce/core'
import type { ReadinessIssue, ReadinessRule, SocialChannel } from '@commerce/core/sales-channels'
import { PlugConnect } from '@commerce/ui/icons'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import KitButton from '@/components/kit/kit-button'
import ChartCard from '@/components/layout/chart-card'
import DataCard from '@/components/layout/data-card'
import EmptyState from '@/components/layout/empty-state'
import KeyValueList from '@/components/layout/key-value-list'
import PageBody from '@/components/layout/page-body'
import PageHeader from '@/components/layout/page-header'
import StatStrip from '@/components/layout/stat-strip'
import { salesChannelsContent } from '@/data/sales-channels'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'
import { percent } from '@/lib/stats'
import ChannelLogo from './channel-logo'
import ChannelOrdersCard from './channel-orders-card'
import ChannelStatusChip from './channel-status-chip'
import ConnectSocialDialog from './connect-social-dialog'
import IssueRow from './issue-row'
import RequestDialog from './request-dialog'
import SyncStatusBar from './sync-status-bar'

type SocialChannelPageProps = {
  data: SocialOverview
  issues: ReadinessIssue[]
}

/** What each partner rejects a product for, so "Before you connect" lists only those. */
const CHANNEL_RULES: Record<SocialChannel, readonly ReadinessRule[]> = {
  instagram: ['no_images', 'no_description', 'no_category', 'no_refund_policy'],
  facebook: ['no_images', 'no_description', 'no_category', 'no_refund_policy'],
  whatsapp: ['no_images', 'no_description'],
  google: [
    'no_identifier',
    'no_images',
    'no_description',
    'no_category',
    'no_refund_policy',
    'no_shipping_policy',
  ],
}
const SHOWN_ISSUES = 6

/** Figma "Instagram / Facebook / WhatsApp / Google · Overview" and their connect states. */
export default function SocialChannelPage({ data, issues }: SocialChannelPageProps) {
  // Hooks
  const router = useRouter()
  const copy = useCopy(salesChannelsContent.socialPage)
  const info = useCopy(salesChannelsContent.social[data.channel])
  const shared = useCopy(salesChannelsContent)
  const format = useFormat()
  const [connecting, setConnecting] = useState(false)
  const [viewing, setViewing] = useState(false)

  // Render logic
  const { channel, state, totals } = data
  const requested = state.status === 'requested'
  const rules = CHANNEL_RULES[channel]
  const blocking = issues.filter((i) => rules.includes(i.rule))
  const name = info.name
  const aov = totals.orders > 0 ? Math.round(totals.revenuePaise / totals.orders) : 0

  return (
    <PageBody className="gap-6 md:py-8">
      <PageHeader
        title={name}
        subtitle={info.blurb}
        lead={{
          kind: 'logo',
          node: <ChannelLogo channel={channel} size="lg" className="border-0 shadow-none" />,
        }}
        badges={<ChannelStatusChip status={requested ? 'requested' : 'not_connected'} />}
        actions={
          requested ? (
            <KitButton variant="secondary" onClick={() => setViewing(true)}>
              {shared.card.viewRequest}
            </KitButton>
          ) : (
            <KitButton onClick={() => setConnecting(true)}>
              <PlugConnect />
              {copy.connectCta(name)}
            </KitButton>
          )
        }
      />
      <SyncStatusBar
        tone={requested ? 'pending' : 'idle'}
        title={requested ? shared.bar.requested(name) : shared.bar.notConnected}
        detail={shared.bar.notConnectedBody}
      />
      <StatStrip
        tiles={[
          {
            id: 'live',
            label: copy.stats.live,
            value: shared.card.none,
            note: copy.stats.liveNote(data.activeProducts),
          },
          {
            id: 'orders',
            label: copy.stats.orders(name),
            value: format.number(totals.orders),
            trend: percent(totals.orders, totals.prevOrders),
            trendNote: shared.vsLast,
          },
          {
            id: 'revenue',
            label: copy.stats.revenue(name),
            value: format.money(totals.revenuePaise),
            trend: percent(totals.revenuePaise, totals.prevRevenuePaise),
            trendNote: shared.vsLast,
          },
          {
            id: 'aov',
            label: copy.stats.aov,
            value: totals.orders > 0 ? format.money(aov) : shared.card.none,
            note: shared.period,
          },
        ]}
      />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="flex flex-col gap-4">
          <DataCard
            title={copy.beforeHeading}
            subtitle={copy.beforeBody(info.partner)}
            count={blocking.length}
            flush
            action={
              <KitButton variant="linkSm" href={routes.salesChannels.agenticReadiness()}>
                {shared.readiness.title}
              </KitButton>
            }
          >
            {blocking.length === 0 ? (
              <EmptyState variant="plain" size="sm" body={shared.readiness.empty} />
            ) : (
              <ul className="divide-y divide-border border-t border-border">
                {blocking.slice(0, SHOWN_ISSUES).map((i) => (
                  <IssueRow
                    key={i.id}
                    severity={i.severity}
                    severityLabel={shared.readiness.severity[i.severity]}
                    title={
                      i.kind === 'policy'
                        ? (shared.readiness.policyNames[i.ref] ?? i.title)
                        : i.title
                    }
                    kind={i.kind === 'policy' ? shared.readiness.policy : shared.readiness.product}
                    detail={
                      i.rule === 'short_description'
                        ? shared.readiness.rules.short_description(i.n ?? 0)
                        : i.rule === 'few_images'
                          ? shared.readiness.rules.few_images(i.n ?? 0)
                          : shared.readiness.rules[i.rule]
                    }
                    action={
                      <KitButton
                        variant="pill"
                        href={
                          i.kind === 'policy'
                            ? routes.settings.policy(i.ref)
                            : routes.products.detail(i.ref)
                        }
                      >
                        {i.fix === 'ai'
                          ? shared.readiness.fixes.attributes
                          : shared.readiness.fixes[i.fix]}
                      </KitButton>
                    }
                  />
                ))}
              </ul>
            )}
          </DataCard>
          <ChartCard
            title={copy.salesHeading(name)}
            subtitle={copy.salesSub(format.money(totals.revenuePaise))}
            periods={[
              {
                id: '30d',
                label: copy.thisPeriod,
                data: data.series.map((p) => ({
                  label: format.date(p.date),
                  value: p.paise / 100,
                })),
              },
            ]}
            seriesLabel={copy.thisPeriod}
            formatValue={(n) => format.moneyCompact(n * 100)}
          />
        </div>
        <DataCard title={copy.connection}>
          <KeyValueList
            variant="grid"
            rows={[
              { label: copy.partner, value: info.partner },
              { label: copy.account, value: state.account ?? shared.card.none },
              {
                label: copy.requestedOn,
                value: state.requestedAt ? format.date(state.requestedAt) : shared.card.none,
                hidden: !requested,
              },
              {
                label: `${copy.checkout} · ${copy.checkoutWhere}`,
                value: shared.controls.rows.onStore,
              },
            ]}
          />
        </DataCard>
      </div>
      <ChannelOrdersCard
        title={copy.recentHeading(name)}
        empty={copy.recentEmpty(name)}
        orders={data.recent}
      />
      {connecting ? (
        <ConnectSocialDialog
          open
          onOpenChange={setConnecting}
          channel={channel}
          activeProducts={data.activeProducts}
          onRequested={() => router.refresh()}
        />
      ) : null}
      {viewing ? (
        <RequestDialog
          open
          onOpenChange={setViewing}
          channel={channel}
          name={name}
          requestedAt={state.requestedAt}
          onWithdrawn={() => router.refresh()}
        />
      ) : null}
    </PageBody>
  )
}
