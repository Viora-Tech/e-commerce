'use client'

import type { RouteRule } from '@commerce/core/delivery-options'
import { ArrowRight } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import type { ReactNode } from 'react'
import StatusChip from '@/components/layout/status-chip'
import { deliveryOptionsContent } from '@/data/delivery-options'
import { deliveryPagesContent } from '@/data/delivery-options-pages'
import { deliveryRuleFormContent } from '@/data/delivery-rule-form'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { ruleRouteLabels, ruleTargetLabel } from './format'
import { chipLabel } from './rule-preview'

type RuleRowProps = {
  rule: RouteRule
  /** 1-based place: higher rules win when a cart can't follow them all. */
  place: number
  optionNames: Map<string, string>
  handle: ReactNode
  isDragging: boolean
  onEdit: () => void
}

const CHIP = 'max-w-full rounded-md border px-2 py-0.5 text-caption'

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
  const form = useCopy(deliveryRuleFormContent)
  const fmt = useFormat()

  // Render logic
  const r = pages.ruleRows
  const target = ruleTargetLabel(rule, copy)
  const options =
    rule.optionIds === 'all'
      ? null
      : rule.optionIds.map((id) => optionNames.get(id) ?? '?').join(', ')
  // Every allowed route by its short name ("Delhivery Surface"), the preferred one first and
  // marked (#1781). The full label with the courier's app made the row run off the page
  // (owner, 21 Nov 2026).
  const routesText = ruleRouteLabels(
    rule,
    copy,
    (label, always) => (always ? r.preferredAlways(label) : r.preferred(label)),
    (s) => chipLabel(s, copy, form),
  ).join(', ')
  const routesChip = `${r.only(routesText)}${rule.insurance === 'required' ? ` (${r.insured})` : ''}`
  const line = options ? r.lineOptions(options, routesText) : r.line(routesText)
  // The rule's price (20 Nov 2026), when it changes the option's own.
  const p = form.suggestions.price
  const price = rule.price ?? { mode: 'option' }
  const priceMain =
    price.mode === 'free'
      ? p.free
      : price.mode === 'fixed'
        ? p.fixed(fmt.money(price.fixedPaise ?? 0))
        : p.option
  const priceChip =
    price.mode === 'option' && price.freeAbovePaise == null
      ? null
      : price.freeAbovePaise != null && price.mode !== 'free'
        ? `${priceMain}, ${p.freeAbove(fmt.money(price.freeAbovePaise))}`
        : priceMain

  return (
    <div
      className={cn(
        'flex items-center gap-2 bg-card py-3 pr-4 pl-1.5',
        isDragging && 'rounded-lg shadow-popover',
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
          {priceChip ? (
            <span className={cn(CHIP, 'border-success-border bg-success-soft text-success')}>
              {priceChip}
            </span>
          ) : null}
        </span>
        <span className="text-caption text-muted-foreground">{line}</span>
      </div>
      <Button variant="ghost" size="sm" onClick={onEdit}>
        {copy.edit}
      </Button>
    </div>
  )
}
