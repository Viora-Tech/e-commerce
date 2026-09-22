'use client'

import { cn } from '@commerce/ui/lib/utils'

type StatTabsProps = {
  items: { label: string; value: string }[]
  active?: number
  onChange?: (index: number) => void
}

/** 5:1595: five 78px cells, 20px apart; 24px figure over a 13px caption, active one tinted with a green rule. */
export default function StatTabs({ items, active = 0, onChange }: StatTabsProps) {
  return (
    <div
      className="grid gap-5"
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map((it, i) => (
        <button
          key={it.label}
          type="button"
          onClick={onChange ? () => onChange(i) : undefined}
          className={cn(
            'flex h-[4.875rem] flex-col items-start gap-2 rounded-t-sm border-b-2 px-3 pt-3.5 text-left transition-colors',
            i === active
              ? 'border-primary bg-background'
              : 'border-border-soft hover:bg-background/60',
          )}
        >
          <span className="text-kit-stat-sm text-foreground tabular-nums">{it.value}</span>
          <span className="text-kit-body text-muted-foreground-soft">{it.label}</span>
        </button>
      ))}
    </div>
  )
}
