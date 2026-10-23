'use client'

import type { CampaignReport } from '@commerce/api'
import DataCard from '@/components/layout/data-card'
import { campaignPerformanceContent } from '@/data/growth-report'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { formatRate } from '@/lib/analytics-range'

type CampaignRatesCardProps = { report: CampaignReport }

type RateId = keyof CampaignReport['rates']

const ORDER: RateId[] = ['delivery', 'open', 'bounce', 'unsubscribe', 'complaint']
/** Matches the API's unsubscribe window (growth-report.service UNSUBSCRIBE_WINDOW_DAYS). */
const UNSUBSCRIBE_DAYS = 7

/**
 * Delivery, open (an estimate), bounce, unsubscribe and complaint rates. A rate the channel
 * never reports reads "not reported by this channel", never 0%.
 */
export default function CampaignRatesCard({ report }: CampaignRatesCardProps) {
  // Hooks
  const copy = useCopy(campaignPerformanceContent.rates)
  const fmt = useFormat()

  // Render logic
  const noteOf = (id: RateId) => {
    if (id === 'open' && report.rates.open) return copy.openNote
    if (id === 'unsubscribe' && report.rates.unsubscribe) {
      return copy.unsubscribeNote(UNSUBSCRIBE_DAYS)
    }
    return null
  }

  return (
    <DataCard title={copy.title}>
      <dl className="flex flex-col">
        {ORDER.map((id) => {
          const rate = report.rates[id]
          const note = noteOf(id)
          return (
            <div
              key={id}
              className="flex flex-col gap-0.5 border-line border-t py-2.5 first:border-t-0 first:pt-0"
            >
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-body text-foreground">{copy[id]}</dt>
                <dd className="text-right">
                  {rate ? (
                    <span className="flex flex-col items-end">
                      <span className="text-body-strong text-ink-strong tabular-nums">
                        {rate.whole > 0 ? formatRate(rate.rate) : '-'}
                      </span>
                      <span className="text-caption text-muted-foreground tabular-nums">
                        {copy.of(fmt.number(rate.part), fmt.number(rate.whole))}
                      </span>
                    </span>
                  ) : (
                    <span className="text-caption text-muted-foreground">{copy.notReported}</span>
                  )}
                </dd>
              </div>
              {note ? <p className="text-caption text-muted-foreground">{note}</p> : null}
            </div>
          )
        })}
      </dl>
    </DataCard>
  )
}
