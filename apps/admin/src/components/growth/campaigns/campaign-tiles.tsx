import { formatNumber } from '@commerce/money'
import { Card } from '@commerce/ui/shadcn/card'
import { campaignReportContent, campaignsContent } from '@/data/marketing-campaigns'
import type { api } from '@/lib/api-client'
import { formatPaise } from '@/lib/money'

type Item = Awaited<ReturnType<typeof api.marketing.campaigns.list>>[number]

type CampaignTilesProps = { campaigns: Item[] }

type TileProps = { title: string; value: string; period: string }

const t = campaignsContent.tiles

function Tile({ title, value, period }: TileProps) {
  return (
    <Card gap="none" inset={4} className="h-[6.5rem] rounded-lg">
      <p className="text-card-title">{title}</p>
      <span className="mt-3 text-stat text-ink-strong tabular-nums">{value}</span>
      <p className="mt-1.5 text-period text-muted-foreground">{period}</p>
    </Card>
  )
}

/** Totals across every campaign: sends, engagement and the sales they brought in. */
export default function CampaignTiles({ campaigns }: CampaignTilesProps) {
  // Render logic
  const sum = (pick: (c: Item) => number) => campaigns.reduce((n, c) => n + pick(c), 0)
  const email = campaigns.filter((c) => c.kind === 'email')
  const sent = sum((c) => c.stats.sent)
  const emailSent = email.reduce((n, c) => n + c.stats.sent, 0)
  const opened = email.reduce((n, c) => n + c.stats.opened, 0)
  const clicked = sum((c) => c.stats.clicked)

  return (
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      <Tile title={t.sent} value={formatNumber(sent)} period={t.period} />
      <Tile
        title={t.openRate}
        value={campaignReportContent.rate(opened, emailSent)}
        period={t.period}
      />
      <Tile
        title={t.clickRate}
        value={campaignReportContent.rate(clicked, sent)}
        period={t.period}
      />
      <Tile
        title={t.sales}
        value={formatPaise(sum((c) => c.stats.revenuePaise))}
        period={t.period}
      />
    </div>
  )
}
