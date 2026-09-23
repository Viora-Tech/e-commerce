'use client'

import { accentCss } from '@commerce/core/admin-accent'
import { Button } from '@commerce/ui/shadcn/button'
import { Switch } from '@commerce/ui/shadcn/switch'
import { useState } from 'react'
import KitTableHead from '@/components/kit/kit-table-head'
import KitWeekToggle from '@/components/kit/kit-week-toggle'
import { appearanceContent } from '@/data/appearance'

type AccentPreviewProps = {
  /** `#rrggbb` being tried; the preview recolours before anything is saved. */
  accent: string
}

const SCOPE = 'accent-preview'
const copy = appearanceContent.preview
const COLUMNS = '5rem 1fr 5rem'
/* A week of sales, 0..1, drawn as a 7-point line in a 100 x 40 box. */
const SERIES = [0.35, 0.5, 0.42, 0.68, 0.55, 0.8, 0.72]
const POINTS = SERIES.map((v, i) => `${(i * 100) / 6},${40 - v * 34}`).join(' ')

/**
 * A slice of the admin in the accent being tried: buttons, pills, table header band,
 * a chart line and a focus ring. The scoped style block recolours only this subtree,
 * in light and dark, so the rest of the page keeps the saved colour until Save.
 */
export default function AccentPreview({ accent }: AccentPreviewProps) {
  // Hooks
  const [pill, setPill] = useState<'all' | 'open' | 'paid'>('all')
  const [tracked, setTracked] = useState(true)

  // Render logic
  const css = accentCss(accent, `#${SCOPE}`)
  const pills = [
    { id: 'all' as const, label: copy.pillActive },
    { id: 'open' as const, label: copy.pillIdle },
    { id: 'paid' as const, label: copy.pillOther },
  ]

  return (
    <section
      id={SCOPE}
      aria-label={copy.heading}
      className="flex flex-col gap-4 rounded-lg border border-border bg-background p-4"
    >
      {css ? (
        // biome-ignore lint/security/noDangerouslySetInnerHtml: accentCss builds this only from a validated hex and derived numbers; anything else yields ''.
        <style dangerouslySetInnerHTML={{ __html: css }} />
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button>{copy.primary}</Button>
        <Button variant="outline">{copy.secondary}</Button>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <KitWeekToggle options={pills} value={pill} onChange={setPill} />
        <div className="flex items-center gap-2 text-body text-foreground">
          <Switch checked={tracked} onCheckedChange={setTracked} aria-label={copy.switchLabel} />
          <span aria-hidden>{copy.switchLabel}</span>
        </div>
      </div>
      <div className="flex flex-col gap-1 rounded-md bg-card">
        <KitTableHead columns={COLUMNS} className="h-11 text-body">
          {copy.tableHead.map((h) => (
            <span key={h}>{h}</span>
          ))}
        </KitTableHead>
        <div className="grid grid-cols-[5rem_1fr_5rem] gap-4 px-2 text-body text-foreground [&>*]:px-2.5 [&>*]:py-2">
          {copy.tableRow.map((c) => (
            <span key={c}>{c}</span>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-caption text-muted-foreground">{copy.chart}</span>
        <svg
          viewBox="0 0 100 40"
          preserveAspectRatio="none"
          className="h-20 w-full"
          role="img"
          aria-label={copy.chart}
        >
          <polygon points={`0,40 ${POINTS} 100,40`} className="fill-primary-soft" />
          <polyline
            points={POINTS}
            fill="none"
            vectorEffect="non-scaling-stroke"
            className="stroke-chart-1 [stroke-width:0.125rem]"
          />
        </svg>
      </div>
      <input
        readOnly
        value={copy.focus}
        aria-label={copy.focus}
        tabIndex={-1}
        className="h-9 rounded-md border border-ring bg-card px-3 text-body text-foreground ring-3 ring-ring/50 outline-none"
      />
    </section>
  )
}
