import type { CampaignReport } from '@commerce/api'
import CampaignFunnelCard from './campaign-funnel-card'
import CampaignLinksCard from './campaign-links-card'
import CampaignRatesCard from './campaign-rates-card'
import CampaignSplitCard from './campaign-split-card'
import CampaignTrendCard from './campaign-trend-card'

type CampaignPerformanceProps = { report: CampaignReport }

/**
 * A sent campaign's results over time, then its funnel and links beside its rates and
 * first-time vs returning split.
 */
export default function CampaignPerformance({ report }: CampaignPerformanceProps) {
  return (
    <div className="flex flex-col gap-4">
      <CampaignTrendCard daily={report.daily} />
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="flex flex-col gap-4">
          <CampaignFunnelCard report={report} />
          <CampaignLinksCard links={report.links} />
        </div>
        <div className="flex flex-col gap-4">
          <CampaignRatesCard report={report} />
          <CampaignSplitCard split={report.split} />
        </div>
      </div>
    </div>
  )
}
