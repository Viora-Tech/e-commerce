'use client'

import type { DeliveryOption } from '@commerce/core/delivery-options'
import { cn } from '@commerce/ui/lib/utils'
import { Switch } from '@commerce/ui/shadcn/switch'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import ChoiceField from '@/components/apps/gst-invoices/choice-field'
import StatusChip from '@/components/layout/status-chip'
import { deliveryOptionSectionsContent } from '@/data/delivery-option-sections'
import { deliveryPagesContent } from '@/data/delivery-options-pages'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'
import FasterCostField from './faster-cost-field'
import InlineWarning from './inline-warning'
import InsuranceOfferFields from './insurance-offer-fields'
import OptionExampleLine from './option-example-line'
import OptionSection from './option-section'
import RoundingField from './rounding-field'

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

type Shows = 'shown' | 'hidden' | 'list'

const showsOf = (o: DeliveryOption): Shows =>
  o.couriers.show === 'list' ? 'list' : o.couriers.showNames ? 'shown' : 'hidden'

/**
 * One option on the Options page, edited in place (Figma 929:11812): the grip, name, "Picked by
 * default" and the on/off switch, then three sections (owner, 21 Nov 2026): what the shopper
 * pays (price, rounding, what faster couriers cost on a list, a live checkout example), which
 * couriers show (Picks, Shows) and insurance and cash on delivery. Everything else (markup
 * amounts, dates, routes) is on the option's own page, "More settings".
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
  const sections = useCopy(deliveryOptionSectionsContent)
  const fmt = useFormat()
  const router = useRouter()

  // Helpers
  const set = (patch: Partial<DeliveryOption>) => onChange({ ...option, ...patch })

  // Event handlers
  const handlePays = (value: string) => {
    if (value === 'more') {
      router.push(routes.apps.page(APP, 'options', option.id))
      return
    }
    const source = value === 'zone' || value === 'free' ? value : 'route'
    set({ price: { ...option.price, source } })
  }
  const handleRounding = (rounding: DeliveryOption['price']['rounding']) =>
    set({
      price: { ...option.price, rounding },
      // A list's "+₹…9" switch only counts on the ₹10 rule; Off turns it off too.
      ...(option.couriers.show === 'list'
        ? { couriers: { ...option.couriers, roundTo9: rounding !== 'off' } }
        : {}),
    })
  const handleShows = (value: string) => {
    const show = value === 'list' ? 'list' : 'one'
    set({ couriers: { ...option.couriers, show, showNames: value !== 'hidden' } })
  }

  // Render logic
  const c = pages.optionCards
  const s = sections.sections
  const listed = option.couriers.show === 'list'
  const page = routes.apps.page(APP, 'options', option.id)
  const p = option.price
  const markup = [
    p.markupPaise ? fmt.money(p.markupPaise) : null,
    p.markupPercent ? `${p.markupPercent}%` : null,
  ].filter(Boolean)
  const routePays = c.paysItems.route(
    markup.length ? markup.join(' + ') : null,
    p.freeAbovePaise != null ? fmt.money(p.freeAbovePaise) : null,
  )
  const express = option.speed === 'express'
  const speedWord = express ? pages.preview.air : pages.preview.surface
  const id = `option-${option.id}`
  const oneCardRisk = listed && option.strategy === 'fastest' && option.couriers.hideSlowerDearer

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
          onCheckedChange={(on) => set({ enabled: on })}
          aria-label={c.enabled(option.name)}
        />
      </div>
      <div className="flex flex-col gap-4 p-4">
        <OptionSection title={s.pays.title}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <ChoiceField
              id={`${id}-pays`}
              label={c.pays}
              value={p.source}
              options={[
                { value: 'route', label: routePays },
                { value: 'zone', label: c.paysItems.zone },
                { value: 'free', label: c.paysItems.free },
                { value: 'more', label: c.paysItems.more },
              ]}
              onChange={handlePays}
            />
            <RoundingField
              id={`${id}-round`}
              value={p.rounding}
              help={listed ? 'list' : 'fixed'}
              onChange={handleRounding}
            />
            {listed ? (
              <FasterCostField
                id={`${id}-extra`}
                value={option.couriers.extra}
                onChange={(extra) => set({ couriers: { ...option.couriers, extra } })}
              />
            ) : null}
          </div>
          <OptionExampleLine option={option} />
        </OptionSection>
        <OptionSection title={s.couriers.title}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <ChoiceField
              id={`${id}-picks`}
              label={c.picks}
              value={option.strategy}
              options={[
                { value: 'cheapest', label: c.picksItems.cheapest },
                { value: 'fastest', label: c.picksItems.fastest },
              ]}
              onChange={(v) => set({ strategy: v === 'fastest' ? 'fastest' : 'cheapest' })}
            />
            <ChoiceField
              id={`${id}-shows`}
              label={c.shows}
              value={showsOf(option)}
              options={[
                { value: 'shown', label: c.showsItems.shown },
                { value: 'hidden', label: c.showsItems.hidden(speedWord) },
                { value: 'list', label: c.showsItems.list },
              ]}
              onChange={handleShows}
            />
          </div>
          {oneCardRisk ? <InlineWarning>{pages.courierList.hideFastest}</InlineWarning> : null}
        </OptionSection>
        <OptionSection title={s.extras.title}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <ChoiceField
              id={`${id}-payment`}
              label={c.payment}
              value={express ? 'prepaid_only' : option.cod.mode}
              options={
                express
                  ? [{ value: 'prepaid_only', label: c.paymentItems.prepaid_only }]
                  : [
                      { value: 'allowed', label: c.paymentItems.allowed },
                      { value: 'prepaid_only', label: c.paymentItems.prepaid_only },
                    ]
              }
              onChange={(v) =>
                set({ cod: { ...option.cod, mode: v === 'allowed' ? 'allowed' : 'prepaid_only' } })
              }
            />
          </div>
          <InsuranceOfferFields option={option} onChange={onChange} idPrefix={id} />
        </OptionSection>
      </div>
    </div>
  )
}
