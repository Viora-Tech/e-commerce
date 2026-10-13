'use client'

import { percentChange, type SearchStats } from '@commerce/core/search-console'
import VisitorListCard, { type VisitorListRow } from '@/components/analytics/visitor-list-card'
import StatTile from '@/components/layout/stat-tile'
import { searchConsoleContent } from '@/data/search-console'
import { useCopy, useFormat, useLocale } from '@/hooks/use-copy'
import { formatRate } from '@/lib/analytics-range'
import { INTL_LOCALE } from '@/lib/i18n'
import ReportFrame from './report-frame'

/** Rows in each short list. */
const TOP = 5

type Named = { key: string; label: string; stats: SearchStats }

/** A short ranked list by clicks, each with its share of all clicks. */
function toRows(items: Named[], totalClicks: number): VisitorListRow[] {
  return items.slice(0, TOP).map((i) => ({
    key: i.key,
    label: i.label,
    count: i.stats.clicks,
    share: totalClicks > 0 ? i.stats.clicks / totalClicks : 0,
  }))
}

/** The countries most Indian stores see; any other shows as its code. */
const ALPHA2: Record<string, string> = {
  ind: 'IN',
  usa: 'US',
  gbr: 'GB',
  are: 'AE',
  can: 'CA',
  aus: 'AU',
  sgp: 'SG',
  sau: 'SA',
  npl: 'NP',
  bgd: 'BD',
  lka: 'LK',
  pak: 'PK',
  deu: 'DE',
  fra: 'FR',
  nzl: 'NZ',
  mys: 'MY',
  qat: 'QA',
  kwt: 'KW',
  omn: 'OM',
  bhr: 'BH',
  irl: 'IE',
  nld: 'NL',
  ita: 'IT',
  esp: 'ES',
  jpn: 'JP',
  zaf: 'ZA',
  ken: 'KE',
  idn: 'ID',
  phl: 'PH',
  tha: 'TH',
}

function countryName(regions: Intl.DisplayNames, alpha3: string): string {
  // Google sends ISO 3166 alpha-3 (`ind`); DisplayNames wants alpha-2, so show the code when unsure.
  const alpha2 = ALPHA2[alpha3.toLowerCase()]
  if (!alpha2) return alpha3.toUpperCase()
  try {
    return regions.of(alpha2) ?? alpha3.toUpperCase()
  } catch {
    return alpha3.toUpperCase()
  }
}

/** The app's first page: totals against the 28 days before, top searches and pages, devices, countries. */
export default function OverviewPage() {
  // Hooks
  const copy = useCopy(searchConsoleContent)
  const fmt = useFormat()
  const locale = useLocale()

  // Render logic
  const regions = new Intl.DisplayNames([INTL_LOCALE[locale]], { type: 'region' })
  const o = copy.overview

  return (
    <ReportFrame title={o.title} summary={o.summary}>
      {(report) => {
        const now = report.totals.current
        const before = report.totals.previous
        const total = now.clicks
        return (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatTile
                label={o.kpis.clicks}
                value={fmt.number(now.clicks)}
                trend={percentChange(now.clicks, before.clicks)}
                trendNote={o.kpis.vsBefore}
              />
              <StatTile
                label={o.kpis.views}
                value={fmt.number(now.impressions)}
                trend={percentChange(now.impressions, before.impressions)}
                trendNote={o.kpis.vsBefore}
              />
              <StatTile
                label={o.kpis.ctr}
                value={formatRate(now.ctr)}
                trend={percentChange(now.ctr, before.ctr)}
                trendNote={o.kpis.vsBefore}
              />
              <StatTile
                label={o.kpis.position}
                value={now.position.toFixed(1)}
                trend={percentChange(now.position, before.position)}
                trendNote={o.kpis.vsBefore}
                note={o.kpis.positionNote}
                invert
              />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <VisitorListCard
                title={o.topSearches}
                empty={o.empty}
                rows={toRows(
                  report.queries.map((q) => ({ key: q.key, label: q.key, stats: q.current })),
                  total,
                )}
              />
              <VisitorListCard
                title={o.topPages}
                empty={o.empty}
                rows={toRows(
                  report.pages.map((p) => ({
                    key: p.key,
                    label: p.item?.title ?? p.key,
                    stats: p.current,
                  })),
                  total,
                )}
              />
              <VisitorListCard
                title={o.devices}
                empty={o.empty}
                rows={toRows(
                  report.devices.map((d) => ({
                    key: d.key,
                    label: o.deviceNames[d.key] ?? d.key,
                    stats: d.stats,
                  })),
                  total,
                )}
              />
              <VisitorListCard
                title={o.countries}
                empty={o.empty}
                rows={toRows(
                  report.countries.map((c) => ({
                    key: c.key,
                    label: countryName(regions, c.key),
                    stats: c.stats,
                  })),
                  total,
                )}
              />
            </div>
          </>
        )
      }}
    </ReportFrame>
  )
}
