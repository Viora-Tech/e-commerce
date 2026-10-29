'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { useState } from 'react'
import PageHeader from '@/components/layout/page-header'
import { gstReturnsContent } from '@/data/gst-invoices'
import { useCopy } from '@/hooks/use-copy'
import GstNumberPicker from './gst-number-picker'
import PeriodsTable from './periods-table'
import { monthLabel, recentMonths } from './return-months'
import ReturnSummary from './return-summary'

/**
 * The Returns tab: pick a GST number and month, check the warnings, download the GSTR-1 JSON
 * for the portal and copy the GSTR-3B figures; below, the filed and closed switches per month.
 */
export default function ReturnsPage() {
  // Hooks
  const copy = useCopy(gstReturnsContent)
  // Returns are filed per GST number; undefined is the store's main one.
  const [gst, setGst] = useState<string | undefined>(undefined)
  // Last month by default: the one due for filing.
  const [period, setPeriod] = useState(() => recentMonths()[1] ?? recentMonths()[0] ?? '')
  const [reloadKey, setReloadKey] = useState(0)

  // Event handlers
  const handleChanged = () => setReloadKey((k) => k + 1)
  const handlePeriod = (next: string) => {
    setPeriod(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Render logic
  const months = recentMonths()
  const items = Object.fromEntries(months.map((m) => [m, monthLabel(m)]))

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={copy.title}
        summary={copy.subtitle}
        actions={
          <span className="flex flex-wrap items-center gap-2">
            <GstNumberPicker value={gst} onChange={setGst} />
            <Select items={items} value={period} onValueChange={(v) => v && setPeriod(String(v))}>
              <SelectTrigger aria-label={copy.monthLabel} className="min-w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map((m) => (
                  <SelectItem key={m} value={m}>
                    {monthLabel(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </span>
        }
      />
      {/* Remounted when the month is marked filed or reopened, so it reads the month again. */}
      <ReturnSummary key={`${gst}-${period}-${reloadKey}`} gst={gst} period={period} />
      <PeriodsTable gst={gst} selected={period} onSelect={handlePeriod} onChanged={handleChanged} />
    </div>
  )
}
