'use client'

import type { DeliveryOption } from '@commerce/core/delivery-options'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { Switch } from '@commerce/ui/shadcn/switch'
import Link from 'next/link'
import type { ReactNode } from 'react'
import StatusChip from '@/components/layout/status-chip'
import { deliveryOptionQuestionsContent } from '@/data/delivery-option-questions'
import { deliveryPagesContent } from '@/data/delivery-options-pages'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'
import { fasterOf } from './option-answers'
import OptionExampleLine from './option-example-line'

type OptionEditCardProps = {
  option: DeliveryOption
  /** Checkout ticks this one when the shopper arrives: the first one shown. */
  isDefault: boolean
  /** The drag grip, from the sortable list. */
  handle: ReactNode
  isDragging: boolean
  onChange: (next: DeliveryOption) => void
}

const APP = 'delivery-options'

/**
 * One option on the Options page (Figma 929:11812): the grip, name, "Picked by default" and the
 * on/off switch, then one summary line of its answers ("Courier cost + markup · One courier ·
 * Rounded to ₹…9"), the live checkout example and Edit (owner, 21 Nov 2026: the in-place fields
 * read as a wall; the option's page asks the 3 questions with everything else under "More
 * settings").
 */
export default function OptionEditCard({
  option,
  isDefault,
  handle,
  isDragging,
  onChange,
}: OptionEditCardProps) {
  // Hooks
  const pages = useCopy(deliveryPagesContent)
  const copy = useCopy(deliveryOptionQuestionsContent)

  // Render logic
  const c = pages.optionCards
  const t = copy.summary
  const page = routes.apps.page(APP, 'options', option.id)
  const listed = option.couriers.show === 'list'
  const faster = fasterOf(option.couriers)
  const rounding = option.price.rounding
  const summary = [
    t.pays[option.price.source],
    listed ? t.faster[faster ?? 'same'] : null,
    rounding === 'off' ? t.notRounded : t.rounded(copy.round.items[rounding]),
  ].filter((x) => x !== null)

  return (
    <div
      className={cn(
        'flex flex-col rounded-lg border border-panel-border bg-card',
        isDragging && 'shadow-popover',
        !option.enabled && 'opacity-70',
      )}
    >
      <div className="flex items-center gap-2 border-b border-hairline py-3 pr-4 pl-1.5">
        {handle}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-2">
            <Link href={page} className="text-body font-semibold text-ink-strong hover:underline">
              {option.name}
            </Link>
            {isDefault ? <StatusChip tone="info">{c.pickedByDefault}</StatusChip> : null}
          </span>
          <span className="text-caption text-muted-foreground">
            {option.description || c.descriptions[option.strategy]}
          </span>
        </div>
        <Switch
          checked={option.enabled}
          onCheckedChange={(on) => onChange({ ...option, enabled: on })}
          aria-label={c.enabled(option.name)}
        />
      </div>
      <div className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-body text-ink-strong">{summary.join(' · ')}</p>
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={page} aria-label={t.editLabel(option.name)} />}
          >
            {t.edit}
          </Button>
        </div>
        <OptionExampleLine option={option} />
      </div>
    </div>
  )
}
