'use client'

import type { RouteRule } from '@commerce/core/delivery-options'
import { ArrowRight } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import type { ReactNode } from 'react'
import StatusChip from '@/components/layout/status-chip'
import { deliveryOptionsContent } from '@/data/delivery-options'
import { deliveryPagesContent } from '@/data/delivery-options-pages'
import { useCopy } from '@/hooks/use-copy'
import { selectorLabel } from './format'

type RuleRowProps = {
  rule: RouteRule
  /** 1-based place: higher rules win when a cart can't follow them all. */
  place: number
  optionNames: Map<string, string>
  handle: ReactNode
  isDragging: boolean
  onEdit: () => void
}

const CHIP = 'rounded-md border px-2 py-0.5 text-caption whitespace-nowrap'

/**
 * One product rule (Figma 929:12840): its place, name, the chip chain target → options → routes
 * and the same in plain words.
 */
export default function RuleRow({
  rule,
  place,
  optionNames,
  handle,
  isDragging,
  onEdit,
}: RuleRowProps) {
  // Hooks
  const copy = useCopy(deliveryOptionsContent)
  const pages = useCopy(deliveryPagesContent)

  // Render logic
  const r = pages.ruleRows
  const t = rule.target
  const target =
    t.kind === 'tags'
      ? copy.rules.targets.tags(t.values.map((v) => `“${v}”`).join(', '))
      : t.kind === 'types'
        ? copy.rules.targets.types(t.values.join(', '))
        : copy.rules.targets[t.kind](t.values.length)
  const options =
    rule.optionIds === 'all'
      ? null
      : rule.optionIds.map((id) => optionNames.get(id) ?? '?').join(', ')
  const main = rule.defaultRoute ? [rule.defaultRoute, ...rule.alternatives] : rule.routes
  const routesText = main.map((s) => selectorLabel(s, copy)).join(', ')
  const routesChip = `${r.only(routesText)}${rule.insurance === 'required' ? ` (${r.insured})` : ''}`
  const line = options ? r.lineOptions(options, routesText) : r.line(routesText)

  return (
    <div
      className={cn(
        'flex items-center gap-2 bg-card py-3 pr-4 pl-1.5',
        isDragging && 'rounded-xl shadow-popover',
      )}
    >
      {handle}
      <span
        aria-hidden="true"
        className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-caption font-medium text-ink-strong tabular-nums"
      >
        {place}
      </span>
      <div
        className={cn('flex min-w-0 flex-1 flex-col gap-1.5 pl-1', !rule.enabled && 'opacity-60')}
      >
        <span className="flex items-center gap-2 text-body font-semibold text-ink-strong">
          {rule.name}
          {rule.enabled ? null : <StatusChip>{r.off}</StatusChip>}
        </span>
        <span className="flex flex-wrap items-center gap-1.5">
          <span className={cn(CHIP, 'border-hairline text-ink-strong')}>{target}</span>
          <ArrowRight aria-hidden className="size-3.5 text-muted-foreground" />
          <span className={cn(CHIP, 'border-hairline text-ink-strong')}>
            {options ? r.only(options) : r.allOptions}
          </span>
          <ArrowRight aria-hidden className="size-3.5 text-muted-foreground" />
          <span className={cn(CHIP, 'border-info/40 bg-info-soft text-info')}>{routesChip}</span>
        </span>
        <span className="text-caption text-muted-foreground">{line}</span>
      </div>
      <Button variant="ghost" size="sm" onClick={onEdit}>
        {copy.edit}
      </Button>
    </div>
  )
}
