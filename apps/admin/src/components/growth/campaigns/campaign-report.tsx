'use client'

import { parseEmailBlocks } from '@commerce/core/marketing'
import { formatNumber } from '@commerce/money'
import { Copy } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import PageBody from '@/components/layout/page-body'
import PageHeader from '@/components/layout/page-header'
import StatusLabel from '@/components/status/status-label'
import { campaignsContent, campaignReportContent as copy } from '@/data/marketing-campaigns'
import { api } from '@/lib/api-client'
import { formatDateTime } from '@/lib/format-date'
import { formatPaise } from '@/lib/money'
import EmailPreview from './email-preview'
import type { LoadedCampaign } from './form-state'
import WhatsappPreview from './whatsapp-preview'

type CampaignReportProps = {
  campaign: LoadedCampaign
  storeName: string
  storefrontUrl: string
}

type StatProps = { label: string; value: string; detail?: string | undefined }

const POLL_MS = 5000

function Stat({ label, value, detail }: StatProps) {
  return (
    <Card className="gap-0 p-4">
      <p className="text-card-title">{label}</p>
      <p className="mt-2 text-stat text-ink-strong tabular-nums">{value}</p>
      <p className="mt-1 min-h-4 text-period text-muted-foreground">{detail ?? ''}</p>
    </Card>
  )
}

function headline(c: LoadedCampaign): string {
  if (c.status === 'scheduled' && c.scheduledAt) {
    return copy.scheduledFor(formatDateTime(c.scheduledAt))
  }
  if (c.status === 'sending') return copy.sendingNow
  if (c.finishedAt) return copy.sentOn(formatDateTime(c.finishedAt))
  return ''
}

/** A scheduled, sending or sent campaign: results, delivery problems and the content as sent. */
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
    const t = setInterval(() => router.refresh(), POLL_MS)
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
    router.push(`/growth/campaigns/${copyRow.id}`)
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
  const t = copy.tiles
  const problems = [
    s.failed ? copy.failed(s.failed) : null,
    s.queued ? copy.queued(s.queued) : null,
  ].filter(Boolean)

  return (
    <PageBody width="wide">
      <PageHeader
        title={campaign.name}
        subtitle={headline(campaign)}
        breadcrumbs={[
          { label: copy.breadcrumb, href: '/growth/campaigns' },
          { label: campaign.name },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <StatusLabel kind="campaign" value={campaign.status} variant="pill" />
            {campaign.status === 'scheduled' || campaign.status === 'sending' ? (
              <Button variant="outline" onClick={handleCancel} disabled={busy}>
                {campaign.status === 'scheduled' ? copy.unschedule : copy.stop}
              </Button>
            ) : null}
            <Button variant="outline" onClick={handleDuplicate} disabled={busy}>
              <Copy />
              {copy.duplicate}
            </Button>
          </div>
        }
      />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Stat label={t.recipients} value={formatNumber(s.recipients)} />
        <Stat label={t.delivered} value={formatNumber(s.sent)} detail={copy.deliveredHelp} />
        <Stat
          label={t.opened}
          value={email ? copy.rate(s.opened, s.sent) : '-'}
          detail={email ? formatNumber(s.opened) : undefined}
        />
        <Stat
          label={t.clicked}
          value={copy.rate(s.clicked, s.sent)}
          detail={formatNumber(s.clicked)}
        />
        <Stat label={t.orders} value={formatNumber(s.orders)} />
        <Stat label={t.sales} value={formatPaise(s.revenuePaise)} />
      </div>
      <p className="text-caption text-muted-foreground">
        {problems.join(' ')} {copy.attribution} {email ? '' : copy.whatsappOpens}
      </p>
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>{copy.audience}</CardTitle>
          </CardHeader>
          <CardContent className="text-body">
            {campaign.segmentName ?? campaignsContent.allSubscribers}
            <span className="ml-2 text-muted-foreground">
              {campaignsContent.kind[campaign.kind]}
            </span>
          </CardContent>
        </Card>
        {email ? (
          <EmailPreview
            storeName={storeName}
            storefrontUrl={storefrontUrl}
            subject={campaign.subject}
            previewText={campaign.previewText}
            blocks={parseEmailBlocks(campaign.blocks)}
          />
        ) : (
          <WhatsappPreview value={campaign.whatsapp} body={null} storeName={storeName} />
        )}
      </div>
    </PageBody>
  )
}
