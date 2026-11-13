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
              'motion-press flex cursor-pointer items-start gap-3 rounded-xl border bg-card p-4 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
              on ? 'border-ink-strong ring-1 ring-ink-strong' : 'border-panel-border',
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
            <span
              aria-hidden="true"
              className={cn(
                'mt-0.5 size-4 shrink-0 rounded-full border',
                on ? 'border-ink-strong bg-ink-strong' : 'border-muted-foreground/50',
              )}
            />
            <span className="flex min-w-0 flex-col gap-1">
              <span className="flex flex-wrap items-center gap-2 text-body font-medium text-ink-strong">
                {layout === 'list' ? l.list : l.fixed}
                {layout === 'list' ? <StatusChip tone="info">{l.recommended}</StatusChip> : null}
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
