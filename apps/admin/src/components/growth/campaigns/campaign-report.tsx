'use client'

import { designHtmlOf, type EmailBlock, parseEmailBlocks, utmName } from '@commerce/core/marketing'
import { formatNumber } from '@commerce/money'
import { Copy, InfoIcon, Send, TriangleAlert, WhatsappLogo } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import DataCard from '@/components/layout/data-card'
import KeyValueList from '@/components/layout/key-value-list'
import PageHeader from '@/components/layout/page-header'
import StatStrip from '@/components/layout/stat-strip'
import OrderChip from '@/components/orders/order-chip'
import {
  campaignEditorContent,
  campaignsContent,
  campaignReportContent as copy,
} from '@/data/marketing-campaigns'
import { api } from '@/lib/api-client'
import { noteRefreshed } from '@/lib/focus-refresh'
import { formatDate, formatDateTime } from '@/lib/format-date'
import { formatPaise, formatPaiseWhole } from '@/lib/money'
import { routes } from '@/lib/routes'
import CampaignPerformance from './campaign-performance'
import EmailPreview from './email-preview'
import type { LoadedCampaign } from './form-state'
import WhatsappPreview from './whatsapp-preview'

type CampaignReportProps = {
  campaign: LoadedCampaign
  storeName: string
  storefrontUrl: string
}

const POLL_MS = 5000

function headline(c: LoadedCampaign): string {
  const parts = [
    c.status === 'scheduled' && c.scheduledAt
      ? copy.scheduledFor(formatDateTime(c.scheduledAt))
      : c.status === 'sending'
        ? copy.sendingNow
        : c.finishedAt
          ? copy.sentOn(formatDateTime(c.finishedAt))
          : '',
    campaignsContent.kind[c.kind],
    c.segmentName ?? campaignsContent.allSubscribers,
  ]
  return parts.filter(Boolean).join(' · ')
}

/** The discount code block's code, when the email carries one. */
function discountCode(blocks: EmailBlock[]): string | null {
  for (const b of blocks) if (b.type === 'discount' && b.code) return b.code
  return null
}

/**
 * Figma "Campaign report" (sent) and "Campaign — scheduled": results, the funnel, rates, links
 * and buyer split, content as sent, audience and orders.
 */
export default function CampaignReport({
  campaign,
  storeName,
  storefrontUrl,
}: CampaignReportProps) {
  // Hooks
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  // Refresh while the worker is still sending, so the numbers move without a reload.
  useEffect(() => {
    if (campaign.status !== 'sending' && campaign.status !== 'scheduled') return
    // Its own poll counts as fresh, so coming back to the tab does not read it twice.
    const t = setInterval(() => {
      noteRefreshed()
      router.refresh()
    }, POLL_MS)
    return () => clearInterval(t)
  }, [campaign.status, router])

  // Event handlers
  const handleDuplicate = async () => {
    setBusy(true)
    const copyRow = await api.marketing.campaigns.duplicate({
      id: campaign.id,
      prefix: copy.copyPrefix,
    })
    setBusy(false)
    if (!copyRow) return
    toast.success(copy.duplicated)
    router.push(routes.growth.campaign(copyRow.id))
  }

  const handleCancel = async () => {
    setBusy(true)
    try {
      await api.marketing.campaigns.cancel({ id: campaign.id })
      toast.success(campaign.status === 'scheduled' ? copy.unscheduled : copy.stopped)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const s = campaign.stats
  const email = campaign.kind === 'email'
  const waiting = campaign.status === 'scheduled'
  const t = copy.tiles
  const n = copy.notes
  const r = copy.rows
  const blocks = parseEmailBlocks(campaign.blocks)
  const audienceCount = waiting ? campaign.audienceCount : s.recipients
  const when = waiting ? campaign.scheduledAt : (campaign.finishedAt ?? campaign.startedAt)
  const dash = '—'

  const contentRows = email
    ? [
        { label: r.subject, value: campaign.subject || dash },
        { label: r.previewText, value: campaign.previewText || dash },
        { label: r.blocks, value: r.blockCount(blocks.length) },
        { label: r.discount, value: discountCode(blocks) ?? r.none },
        { label: r.links, value: `utm_campaign=${utmName(campaign.name)}` },
      ]
    : [
        { label: r.template, value: campaign.whatsapp?.name ?? dash },
        { label: r.language, value: campaign.whatsapp?.language ?? dash },
        ...(campaign.whatsapp?.variables ?? []).map((v, i) => ({
          label: r.variable(i + 1),
          value: v || dash,
        })),
      ]

  return (
    <div className="flex w-full flex-col gap-6 px-4 pt-4 pb-6 md:px-8 md:pt-5 md:pb-8">
      <PageHeader
        title={campaign.name}
        summary={headline(campaign)}
        back={{ label: copy.breadcrumb, href: routes.growth.campaigns() }}
        lead={{
          kind: 'icon',
          node: email ? <Send aria-hidden="true" /> : <WhatsappLogo aria-hidden="true" />,
        }}
        badges={<OrderChip kind="campaign" value={campaign.status} />}
        actions={
          <>
            {campaign.status === 'scheduled' || campaign.status === 'sending' ? (
              <Button variant="outline" onClick={handleCancel} disabled={busy}>
                {campaign.status === 'scheduled' ? copy.unschedule : copy.stop}
              </Button>
            ) : null}
            <Button variant="outline" onClick={handleDuplicate} disabled={busy}>
              <Copy />
              {copy.duplicate}
            </Button>
          </>
        }
      />
      <StatStrip
        tiles={[
          {
            id: 'recipients',
            label: t.recipients,
            value: formatNumber(audienceCount),
            note: campaign.segmentName ?? campaignsContent.allSubscribers,
          },
          {
            id: 'delivered',
            label: t.delivered,
            value: waiting ? dash : formatNumber(s.sent),
            note: copy.deliveredHelp,
          },
          {
            id: 'opened',
            label: t.opened,
            value: !email || waiting ? dash : copy.rate(s.opened, s.sent),
            note: !email ? n.notReported : waiting ? n.afterSend : n.opens(s.opened),
          },
          {
            id: 'clicked',
            label: t.clicked,
            value: waiting ? dash : formatNumber(s.clicked),
            note: waiting ? n.afterSend : n.ofDelivered(copy.rate(s.clicked, s.sent)),
          },
          {
            id: 'orders',
            label: t.orders,
            value: waiting ? dash : formatNumber(s.orders),
            note: n.window,
          },
          {
            id: 'sales',
            label: t.sales,
            value: waiting ? dash : formatPaiseWhole(s.revenuePaise),
            note: n.fromOrders(waiting ? 0 : s.orders),
          },
        ]}
      />
      {waiting && campaign.scheduledAt ? (
        <p className="flex items-center gap-2 rounded-lg border border-info/30 bg-info-soft px-4 py-2.5 text-body text-info">
          <InfoIcon className="size-4 shrink-0" aria-hidden="true" />
          {copy.scheduledNote(formatDateTime(campaign.scheduledAt), campaign.audienceCount)}
        </p>
      ) : null}
      {s.failed > 0 || s.queued > 0 ? (
        <p className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning-soft px-4 py-2.5 text-body text-warning-foreground dark:text-warning">
          <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
          {[
            s.failed ? (email ? copy.failed(s.failed) : copy.failedWhatsapp(s.failed)) : null,
            s.queued ? copy.queued(s.queued) : null,
          ]
            .filter(Boolean)
            .join(' ')}
        </p>
      ) : null}
      {campaign.report ? <CampaignPerformance report={campaign.report} /> : null}
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <DataCard title={copy.content}>
          <div className="grid gap-4 md:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
            {email ? (
              <EmailPreview
                storeName={storeName}
                storefrontUrl={storefrontUrl}
                subject={campaign.subject}
                previewText={campaign.previewText}
                blocks={blocks}
                designHtml={designHtmlOf(campaign)}
              />
            ) : (
              <WhatsappPreview value={campaign.whatsapp} body={null} storeName={storeName} />
            )}
            <div className="flex flex-col gap-3">
              <KeyValueList variant="grid" rows={contentRows} />
              <p className="text-caption text-muted-foreground">{copy.attribution}</p>
            </div>
          </div>
        </DataCard>
        <div className="flex flex-col gap-4">
          <DataCard title={copy.audience}>
            <KeyValueList
              variant="grid"
              rows={[
                {
                  label: r.segment,
                  value: campaign.segmentName ?? campaignsContent.allSubscribers,
                },
                {
                  label: email ? r.accepts : r.optedIn,
                  value: r.customers(audienceCount),
                },
                {
                  label: waiting ? r.sends : r.sent,
                  value: when ? formatDateTime(when) : dash,
                },
              ]}
            />
            <p className="mt-3 text-caption text-muted-foreground">
              {email
                ? campaignEditorContent.audience.consentEmail
                : campaignEditorContent.audience.consentWhatsapp}
            </p>
          </DataCard>
          <DataCard title={copy.ordersHeading}>
            {campaign.recentOrders.length === 0 ? (
              <p className="text-body text-muted-foreground">
                {waiting ? copy.ordersEmpty : copy.ordersNone}
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {campaign.recentOrders.map((o) => (
                  <li key={o.id} className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col">
                      <Link
                        href={routes.orders.detail(o.id)}
                        className="text-body font-medium text-foreground hover:underline"
                      >
                        #{o.number}
                      </Link>
                      <span className="truncate text-caption text-muted-foreground">
                        {[o.customer, formatPaise(o.totalPaise)].filter(Boolean).join(' · ')}
                      </span>
                    </div>
                    <span className="shrink-0 text-caption text-muted-foreground">
                      {formatDate(o.placedAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </DataCard>
        </div>
      </div>
    </div>
  )
}
