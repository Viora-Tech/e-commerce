'use client'

import { designHtmlOf, type EmailBlock, parseEmailBlocks, utmName } from '@commerce/core/marketing'
import { formatNumber } from '@commerce/money'
import { Copy, InfoIcon, Send, TriangleAlert, WhatsappLogo } from '@commerce/ui/icons'
import { Alert, AlertDescription } from '@commerce/ui/shadcn/alert'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import DataCard from '@/components/layout/data-card'
import EmptyState from '@/components/layout/empty-state'
import KeyValueList from '@/components/layout/key-value-list'
import PageBody from '@/components/layout/page-body'
import PageHeader from '@/components/layout/page-header'
import StatStrip from '@/components/layout/stat-strip'
import StatusLabel from '@/components/status/status-label'
import {
  campaignEditorContent,
  campaignReportContent,
  campaignsContent,
} from '@/data/marketing-campaigns'
import { useCopy } from '@/hooks/use-copy'
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
  const copy = useCopy(campaignReportContent)
  const campaignsCopy = useCopy(campaignsContent)
  const campaignEditorCopy = useCopy(campaignEditorContent)
  const router = useRouter()
  /* Which header action runs, so it spins on its own button and the other waits. */
  const [busy, setBusy] = useState<'cancel' | 'duplicate' | null>(null)

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

  // Derived
  function headline(c: LoadedCampaign): string {
    const parts = [
      c.status === 'scheduled' && c.scheduledAt
        ? copy.scheduledFor(formatDateTime(c.scheduledAt))
        : c.status === 'sending'
          ? copy.sendingNow
          : c.finishedAt
            ? copy.sentOn(formatDateTime(c.finishedAt))
            : '',
      campaignsCopy.kind[c.kind],
      c.segmentName ?? campaignsCopy.allSubscribers,
    ]
    return parts.filter(Boolean).join(' · ')
  }

  // Event handlers
  const handleDuplicate = async () => {
    setBusy('duplicate')
    let copyRow: Awaited<ReturnType<typeof api.marketing.campaigns.duplicate>>
    try {
      copyRow = await api.marketing.campaigns.duplicate({
        id: campaign.id,
        prefix: copy.copyPrefix,
      })
    } finally {
      setBusy(null)
    }
    if (!copyRow) return
    toast.success(copy.duplicated)
    router.push(routes.growth.campaign(copyRow.id))
  }

  const handleCancel = async () => {
    setBusy('cancel')
    try {
      await api.marketing.campaigns.cancel({ id: campaign.id })
      toast.success(campaign.status === 'scheduled' ? copy.unscheduled : copy.stopped)
      router.refresh()
    } finally {
      setBusy(null)
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
    <PageBody>
      <PageHeader
        title={campaign.name}
        summary={headline(campaign)}
        back={{ label: copy.breadcrumb, href: routes.growth.campaigns() }}
        lead={{
          kind: 'icon',
          node: email ? <Send aria-hidden="true" /> : <WhatsappLogo aria-hidden="true" />,
        }}
        badges={<StatusLabel kind="campaign" value={campaign.status} variant="soft" />}
        actions={
          <>
            {campaign.status === 'scheduled' || campaign.status === 'sending' ? (
              <Button
                variant="outline"
                onClick={handleCancel}
                loading={busy === 'cancel'}
                disabled={busy !== null}
              >
                {campaign.status === 'scheduled' ? copy.unschedule : copy.stop}
              </Button>
            ) : null}
            <Button
              variant="outline"
              onClick={handleDuplicate}
              loading={busy === 'duplicate'}
              disabled={busy !== null}
            >
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
            note: campaign.segmentName ?? campaignsCopy.allSubscribers,
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
        <Alert tone="info">
          <InfoIcon aria-hidden="true" />
          <AlertDescription>
            {copy.scheduledNote(formatDateTime(campaign.scheduledAt), campaign.audienceCount)}
          </AlertDescription>
        </Alert>
      ) : null}
      {s.failed > 0 || s.queued > 0 ? (
        <Alert tone="warning">
          <TriangleAlert aria-hidden="true" />
          <AlertDescription>
            {[
              s.failed ? (email ? copy.failed(s.failed) : copy.failedWhatsapp(s.failed)) : null,
              s.queued ? copy.queued(s.queued) : null,
            ]
              .filter(Boolean)
              .join(' ')}
          </AlertDescription>
        </Alert>
      ) : null}
      {campaign.report ? <CampaignPerformance report={campaign.report} /> : null}
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,23.5rem)]">
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
        <div className="flex flex-col gap-6">
          <DataCard title={copy.audience}>
            <KeyValueList
              variant="grid"
              rows={[
                {
                  label: r.segment,
                  value: campaign.segmentName ?? campaignsCopy.allSubscribers,
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
                ? campaignEditorCopy.audience.consentEmail
                : campaignEditorCopy.audience.consentWhatsapp}
            </p>
          </DataCard>
          <DataCard title={copy.ordersHeading}>
            {campaign.recentOrders.length === 0 ? (
              <EmptyState variant="inline" body={waiting ? copy.ordersEmpty : copy.ordersNone} />
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
    </PageBody>
  )
}
