'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { NativeSelect, NativeSelectOption } from '@commerce/ui/shadcn/native-select'
import { type ReactNode, useId } from 'react'
import { ordersContent } from '@/data/orders'
import { useCopy } from '@/hooks/use-copy'
import {
  DATE_FILTERS,
  type DateFilter,
  FULFILMENT_FILTERS,
  METHOD_FILTERS,
  type OrderFilters as OrderFiltersValue,
  PAYMENT_FILTERS,
} from '@/lib/order-list-filters'

type OrderFiltersProps = {
  value: OrderFiltersValue
  onChange: (patch: Partial<OrderFiltersValue>) => void
  onClear: () => void
  /** Orders matching right now, for the "Show n orders" button. */
  total: number
  /** Closes the panel (the footer button). */
  onDone: () => void
}

type SectionProps = { title: string; children: ReactNode }

type ChecksProps<K extends string> = {
  keys: readonly K[]
  labels: Record<K, string>
  checked: K[]
  onChange: (next: K[]) => void
}

/** Ticks or unticks one key, keeping the panel's order. */
function toggle<K extends string>(keys: readonly K[], checked: K[], key: K): K[] {
  const on = checked.includes(key)
  return keys.filter((k) => (k === key ? !on : checked.includes(k)))
}

/* Figma "Orders · Filter": a 12px muted group title over its controls, groups split by a hairline. */
function Section({ title, children }: SectionProps) {
  return (
    <div className="flex flex-col gap-1.5 border-border border-t px-3.5 py-3 first:border-t-0">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      {children}
    </div>
  )
}

function Checks<K extends string>({ keys, labels, checked, onChange }: ChecksProps<K>) {
  // Hooks
  const id = useId()

  return (
    <div className="flex flex-col">
      {keys.map((k) => (
        <div key={k} className="flex h-7 items-center gap-2.5">
          <Checkbox
            id={`${id}-${k}`}
            checked={checked.includes(k)}
            onCheckedChange={() => onChange(toggle(keys, checked, k))}
          />
          <label htmlFor={`${id}-${k}`} className="cursor-pointer text-body text-foreground">
            {labels[k]}
          </label>
        </div>
      ))}
    </div>
  )
}

/**
 * The Orders filter panel (Figma "Orders · Filter", 623:17260): Payment, Fulfilment, Date and
 * Payment method. Each tick applies at once; the footer shows how many orders match and closes.
 */
export default function OrderFilters({
  value,
  onChange,
  onClear,
  total,
  onDone,
}: OrderFiltersProps) {
  // Hooks
  const orders = useCopy(ordersContent)

  // Event handlers
  const handleDate = (next: string) => {
    onChange({ date: DATE_FILTERS.find((d) => d === next) ?? null })
  }

  // Render logic
  const copy = orders.filters
  return (
    <div className="flex max-h-[min(36rem,var(--available-height))] flex-col">
      <div className="flex h-11 shrink-0 items-center justify-between border-border border-b px-3.5">
        <p className="text-body font-medium text-ink-strong">{copy.heading}</p>
        <Button variant="ghost" size="sm" className="-mr-2" onClick={onClear}>
          {copy.clearAll}
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <Section title={copy.payment}>
          <Checks
            keys={PAYMENT_FILTERS}
            labels={copy.paymentOptions}
            checked={value.payment}
            onChange={(payment) => onChange({ payment })}
          />
        </Section>
        <Section title={copy.fulfilment}>
          <Checks
            keys={FULFILMENT_FILTERS}
            labels={copy.fulfilmentOptions}
            checked={value.fulfilment}
            onChange={(fulfilment) => onChange({ fulfilment })}
          />
        </Section>
        <Section title={copy.date}>
          <NativeSelect
            className="w-full"
            aria-label={copy.date}
            value={value.date ?? ''}
            onChange={(e) => handleDate(e.target.value)}
          >
            <NativeSelectOption value="">{copy.anyDate}</NativeSelectOption>
            {DATE_FILTERS.map((d: DateFilter) => (
              <NativeSelectOption key={d} value={d}>
                {copy.dateOptions[d]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Section>
        <Section title={copy.method}>
          <Checks
            keys={METHOD_FILTERS}
            labels={copy.methodOptions}
            checked={value.method}
            onChange={(method) => onChange({ method })}
          />
        </Section>
      </div>
      <div className="shrink-0 border-border border-t p-3">
        <Button className="w-full" onClick={onDone}>
          {copy.show(total)}
        </Button>
      </div>
    </div>
  )
}
