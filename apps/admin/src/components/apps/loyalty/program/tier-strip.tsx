'use client'

import { type LoyaltySettings, pointsLabel } from '@commerce/core/loyalty'
import { ListView, Plus } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import { loyaltyProgramContent } from '@/data/loyalty-program'
import { useCopy, useLocale } from '@/hooks/use-copy'
import type { TierDraft } from '@/lib/loyalty-program'
import { formatPaiseWhole } from '@/lib/money'
import TierCompareDialog from './tier-compare-dialog'

type TierStripProps = {
  tiers: TierDraft[]
  selected: TierDraft | null
  settings: LoyaltySettings
  onSelect: (key: string) => void
  onAdd: () => void
}

/**
 * The tier strip: every tier as a tab (its colour, name and where it starts), the picked one
 * raised; "+ Tier" at the end and a button that compares the tiers side by side. Picking a tier
 * switches the whole page below to it.
 */
export default function TierStrip({ tiers, selected, settings, onSelect, onAdd }: TierStripProps) {
  // Hooks
  const copy = useCopy(loyaltyProgramContent)
  const locale = useLocale()
  const [comparing, setComparing] = useState(false)

  // Helpers
  const from = (t: TierDraft, i: number) => {
    if (i === 0) return copy.tiers.starting
    const at =
      settings.tierBasis === 'spend'
        ? formatPaiseWhole(t.threshold, locale)
        : pointsLabel(t.threshold, settings)
    return copy.tiers.from(at)
  }

  // Render logic
  const c = copy.tiers

  return (
    <div className="flex items-stretch gap-2">
      <div
        role="tablist"
        aria-label={c.stripLabel}
        className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto rounded-lg border border-line bg-muted p-1"
      >
        {tiers.length === 0 ? (
          <span className="px-3 py-2 text-body text-muted-foreground">{c.empty}</span>
        ) : null}
        {tiers.map((t, i) => {
          const on = selected?.key === t.key
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => onSelect(t.key)}
              className={cn(
                'flex min-w-[9rem] shrink-0 items-center gap-2.5 rounded-md px-3 py-2 text-left transition-colors',
                on ? 'bg-card shadow-xs' : 'hover:bg-card/60',
              )}
            >
              <span
                aria-hidden
                className="size-6 shrink-0 rounded-md"
                style={{ backgroundColor: t.colors.background }}
              />
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-body font-medium text-ink-strong">
                  {t.name.trim() || c.unnamed}
                </span>
                <span className="truncate text-caption text-muted-foreground">{from(t, i)}</span>
              </span>
            </button>
          )
        })}
        <Button size="sm" variant="ghost" className="ml-auto shrink-0" onClick={onAdd}>
          <Plus />
          {c.add}
        </Button>
      </div>
      <Button
        variant="outline"
        size="icon"
        className="h-auto self-stretch px-3"
        aria-label={c.compare}
        disabled={tiers.length === 0}
        onClick={() => setComparing(true)}
      >
        <ListView />
      </Button>
      <TierCompareDialog
        open={comparing}
        tiers={tiers}
        settings={settings}
        onClose={() => setComparing(false)}
      />
    </div>
  )
}
