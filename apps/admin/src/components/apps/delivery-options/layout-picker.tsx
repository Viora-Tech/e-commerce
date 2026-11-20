'use client'

import type { DeliveryLayout } from '@commerce/core/delivery-options'
import { cn } from '@commerce/ui/lib/utils'
import StatusChip from '@/components/layout/status-chip'
import { deliveryPagesContent } from '@/data/delivery-options-pages'
import { useCopy } from '@/hooks/use-copy'

type LayoutPickerProps = {
  value: DeliveryLayout
  onChange: (layout: DeliveryLayout) => void
}

const LAYOUTS: readonly DeliveryLayout[] = ['list', 'fixed']

/** Options: Courier list (automatic) or Fixed options, as two radio cards (Figma 938:12101). */
export default function LayoutPicker({ value, onChange }: LayoutPickerProps) {
  // Hooks
  const pages = useCopy(deliveryPagesContent)

  // Render logic
  const l = pages.layout

  return (
    <fieldset className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <legend className="sr-only">{l.label}</legend>
      {LAYOUTS.map((layout) => {
        const on = value === layout
        return (
          <label
            key={layout}
            className={cn(
              'motion-press flex cursor-pointer items-start gap-3 rounded-lg border p-4 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
              // The chosen mode is unmistakable (#1781 item 8): tinted card, 2px primary edge.
              on
                ? 'border-primary bg-primary-soft ring-1 ring-primary'
                : 'border-panel-border bg-card hover:bg-row-hover',
            )}
          >
            <input
              type="radio"
              name="delivery-layout"
              value={layout}
              checked={on}
              onChange={() => onChange(layout)}
              className="sr-only"
            />
            {/* A real radio look: a ring, filled with a dot when chosen. */}
            <span
              aria-hidden="true"
              className={cn(
                'mt-0.5 flex size-4.5 shrink-0 items-center justify-center rounded-full border-2',
                on ? 'border-primary' : 'border-muted-foreground/60',
              )}
            >
              {on ? <span className="size-2 rounded-full bg-primary" /> : null}
            </span>
            <span className="flex min-w-0 flex-col gap-1">
              <span className="flex flex-wrap items-center gap-2 text-body font-medium text-ink-strong">
                {layout === 'list' ? l.list : l.fixed}
                {on ? <StatusChip tone="success">{l.selected}</StatusChip> : null}
                {layout === 'list' && !on ? (
                  <StatusChip tone="info">{l.recommended}</StatusChip>
                ) : null}
              </span>
              <span className="text-caption text-muted-foreground">
                {layout === 'list' ? l.listHelp : l.fixedHelp}
              </span>
            </span>
          </label>
        )
      })}
    </fieldset>
  )
}
