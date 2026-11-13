'use client'

import { cn } from '@commerce/ui/lib/utils'
import { Switch } from '@commerce/ui/shadcn/switch'
import ChoiceField from '@/components/apps/gst-invoices/choice-field'
import { bulkShipContent } from '@/data/bulk-ship'
import { useCopy, useFormat } from '@/hooks/use-copy'
import type { EditForm } from './bulk-edit-state'
import { type BulkLine, rulePick } from './bulk-ship-state'
import { isBookable } from './flow-state'
import { insuredRows } from './insured-rows'

type BulkEditShippingProps = {
  line: BulkLine
  form: EditForm
  onChange: (form: EditForm) => void
  /** The package or payment was changed: the prices shown answer the old one until saved. */
  repricing: boolean
}

const SHORT_DATE = { weekday: 'short', day: 'numeric', month: 'short' } as const

/** The Edit popup's right half (Figma 913:9698): the courier for this order with the shopper's
 *  checkout choice beside it, how it is paid, its insurance, and what it costs. */
export default function BulkEditShipping({
  line,
  form,
  onChange,
  repricing,
}: BulkEditShippingProps) {
  // Hooks
  const all = useCopy(bulkShipContent)
  const fmt = useFormat()

  // Helpers
  const price = (paise: number | null) => (paise === null ? all.rateOnBooking : fmt.money(paise))

  // Render logic
  const copy = all.editPopup
  const rows = insuredRows(line.quote?.options ?? [], form.insured).filter(isBookable)
  const picked =
    rows.find((r) => r.optionKey === form.optionKey) ??
    rows.find((r) => r.optionKey === line.pick?.optionKey) ??
    rulePick(rows, line.quote?.checkout ?? null, 'recommended', null)
  const cheapest = rows.find((r) => r.badges.includes('cheapest'))
  const fastest = rows.find((r) => r.badges.includes('fastest'))
  const choice = line.order.deliveryChoice
  const value = line.parcel?.valuePaise ?? line.order.totalPaise

  return (
    <div className="flex flex-col gap-4">
      <p className="text-caption font-medium tracking-wide text-muted-foreground uppercase">
        {copy.shipping}
      </p>
      <p
        className={cn(
          'rounded-lg border px-3 py-2 text-caption',
          choice ? 'border-info/30 bg-info-soft text-info' : 'border-border text-muted-foreground',
        )}
      >
        {choice
          ? `${all.shopperChose(choice.name, choice.pricePaise > 0 ? fmt.money(choice.pricePaise) : all.free)}${choice.route ? ` (${choice.route})` : ''}`
          : copy.noShopperChoice}
      </p>
      {rows.length === 0 ? (
        <p className="text-body text-danger">{all.problem.noCourier}</p>
      ) : (
        <ChoiceField
          id="bulk-edit-courier"
          label={copy.courier}
          value={picked?.optionKey ?? ''}
          options={rows.map((r) => ({
            value: r.optionKey,
            label: `${copy.courierOption(
              r.providerLabel,
              r.deliveryBy ? fmt.pattern(r.deliveryBy, SHORT_DATE) : '',
              price(r.pricePaise),
            )}${r.chosenAtCheckout ? ` · ${all.source.shopper}` : ''}`,
          }))}
          onChange={(optionKey) => onChange({ ...form, optionKey })}
          help={
            repricing
              ? copy.repriceNote
              : copy.alternatives(
                  cheapest ? `${cheapest.providerLabel} ${price(cheapest.pricePaise)}` : null,
                  fastest ? `${fastest.providerLabel} ${price(fastest.pricePaise)}` : null,
                )
          }
        />
      )}
      <div className="flex flex-col gap-1.5">
        <p className="text-body font-medium text-ink-strong">{copy.payment}</p>
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
          {(['prepaid', 'cod'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={form.paymentMode === mode}
              onClick={() => onChange({ ...form, paymentMode: mode })}
              className={cn(
                'motion-press h-9 rounded-md px-3 text-body',
                form.paymentMode === mode
                  ? 'bg-background font-medium text-ink-strong shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {mode === 'prepaid' ? copy.prepaid : copy.codCollect(fmt.money(value))}
            </button>
          ))}
        </div>
        <p className="text-caption text-muted-foreground">
          {line.order.paymentMode === 'cod' ? copy.codHelp : copy.prepaidHelp}
        </p>
      </div>
      <label
        htmlFor="bulk-edit-insurance"
        className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-border px-4 py-3"
      >
        <span className="flex flex-col">
          <span className="text-body font-medium text-ink-strong">{copy.insurance}</span>
          <span className="text-caption text-muted-foreground">
            {copy.insuranceCovers(fmt.money(value))}
          </span>
        </span>
        <Switch
          id="bulk-edit-insurance"
          checked={form.insured}
          onCheckedChange={(insured) => onChange({ ...form, insured })}
        />
      </label>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-body text-muted-foreground">{copy.charge}</span>
        <span className="font-semibold text-ink-strong tabular-nums">
          {picked?.pricePaise != null
            ? copy.chargeValue(fmt.money(picked.pricePaise), form.insured)
            : picked
              ? all.rateOnBooking
              : '—'}
        </span>
      </div>
    </div>
  )
}
