'use client'

import type { DashboardSummary } from '@commerce/api'
import DataCard from '@/components/layout/data-card'
import { homeContent } from '@/data/home'
import { useCopy } from '@/hooks/use-copy'

type HoursHeatmapProps = {
  hoursHeatmap: DashboardSummary['hoursHeatmap']
}

type Peak = { weekday: number; fromHour: number; toHour: number } | null

/** The busiest weekday, and the widest run of its busiest-quarter hours, for the plain line. */
function findPeak(heatmap: number[][]): Peak {
  const totals = heatmap.map((row) => row.reduce((n, v) => n + v, 0))
  const grandTotal = totals.reduce((n, v) => n + v, 0)
  if (grandTotal === 0) return null
  const weekday = totals.indexOf(Math.max(...totals))
  const row = heatmap[weekday] ?? []
  const threshold = Math.max(...row) * 0.6
  let fromHour = row.findIndex((v) => v >= threshold)
  let toHour = fromHour
  for (let h = fromHour; h < row.length; h++) {
    if ((row[h] ?? 0) >= threshold) toHour = h
    else break
  }
  if (fromHour < 0) fromHour = 0
  return { weekday, fromHour, toHour: Math.max(toHour, fromHour) + 1 }
}

/** Fewer to darker: opacity scaled 0.06 (none) to 1 (the busiest cell). */
function opacityFor(count: number, max: number): number {
  if (max <= 0 || count <= 0) return 0.04
  return 0.15 + (count / max) * 0.85
}

/** Orders by weekday x hour (IST, last 30 days), so the owner sees when people actually buy. */
export default function HoursHeatmap({ hoursHeatmap }: HoursHeatmapProps) {
  // Hooks
  const copy = useCopy(homeContent)

  // Render logic
  const c = copy.charts
  const max = Math.max(0, ...hoursHeatmap.flat())
  const peak = findPeak(hoursHeatmap)
  const line = peak
    ? c.heatmapLine(
        c.days[peak.weekday] ?? '',
        c.hourLabel(peak.fromHour),
        c.hourLabel(peak.toHour % 24),
      )
    : null

  return (
    <DataCard title={c.heatmapTitle}>
      {max === 0 ? (
        <p className="text-body text-muted-foreground">{c.heatmapEmpty}</p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="overflow-x-auto">
            <table className="border-separate border-spacing-[2px]">
              <caption className="sr-only">{c.heatmapTitle}</caption>
              <tbody>
                {hoursHeatmap.map((row, weekday) => (
                  <tr key={c.days[weekday]}>
                    <th
                      scope="row"
                      className="pr-2 text-right text-caption font-normal text-muted-foreground"
                    >
                      {c.days[weekday]}
                    </th>
                    {row.map((count, hour) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: fixed 24-hour row, order never changes.
                      <td key={`${weekday}-${hour}`} className="p-0">
                        <div
                          role="img"
                          aria-label={c.heatmapCell(
                            c.days[weekday] ?? '',
                            c.hourLabel(hour),
                            count,
                          )}
                          className="size-[0.5625rem] rounded-[0.1875rem] sm:size-[0.75rem]"
                          style={{
                            backgroundColor: 'var(--chart-1)',
                            opacity: opacityFor(count, max),
                          }}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-1.5 text-caption text-muted-foreground">
            <span>{c.heatmapLegendLow}</span>
            <div className="flex items-center gap-0.5" aria-hidden>
              {[0.2, 0.4, 0.6, 0.8, 1].map((step) => (
                <span
                  key={step}
                  className="size-2.5 rounded-[0.1875rem]"
                  style={{ backgroundColor: 'var(--chart-1)', opacity: step }}
                />
              ))}
            </div>
            <span>{c.heatmapLegendHigh}</span>
          </div>
          {line ? <p className="text-caption text-muted-foreground">{line}</p> : null}
        </div>
      )}
    </DataCard>
  )
}
