'use client'

import type { ShippingPolicySettings } from '@commerce/core'
import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import Link from 'next/link'
import { INDIAN_STATES } from '@/data/india'
import { shippingSettingsContent } from '@/data/shipping'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'

type Warehouse = ShippingPolicySettings['warehouse']

type ReturnAddressFieldsProps = {
  value: Warehouse
  onChange: (next: Warehouse) => void
  /** Scroll the heading into view (Create shipment's Ship from › Edit). */
  focus: boolean
}

const STATE_ITEMS = INDIAN_STATES.map((s) => ({ value: s.code, label: s.name }))

/** The state picker's options; a saved value that is not a known code stays listed as typed. */
const stateItems = (saved: string) =>
  saved && !STATE_ITEMS.some((s) => s.value === saved)
    ? [...STATE_ITEMS, { value: saved, label: saved }]
    : STATE_ITEMS

/**
 * The store-wide return address on Settings › Shipping, which is also Create shipment's Ship from.
 * Blank line 1 means couriers use the Store details address, so the block says so.
 */
export default function ReturnAddressFields({ value, onChange, focus }: ReturnAddressFieldsProps) {
  // Hooks
  const { policy: p } = useCopy(shippingSettingsContent)

  // Helpers
  const set = (k: keyof Warehouse, v: string) => onChange({ ...value, [k]: v })
  const text = (k: 'name' | 'line1' | 'line2' | 'city', label: string, span: boolean) => (
    <Field className={span ? 'sm:col-span-2' : undefined}>
      <FieldLabel htmlFor={`wh-${k}`}>{label}</FieldLabel>
      <Input id={`wh-${k}`} value={value[k]} autoComplete="off" onChange={(e) => set(k, e.target.value)} />
    </Field>
  )

  // Render logic
  const empty = !value.line1.trim()
  const items = stateItems(value.state)

  return (
    <section
      aria-labelledby="wh-heading"
      className="flex flex-col gap-4 border-b border-hairline py-5 last:border-b-0"
    >
      <div className="flex flex-col gap-0.5">
        <h3
          id="wh-heading"
          ref={(el) => {
            if (focus) el?.scrollIntoView({ block: 'center' })
          }}
          className="text-body font-semibold text-ink-strong"
        >
          {p.warehouse}
        </h3>
        <p className="text-caption text-muted-foreground">{p.warehouseHelp}</p>
      </div>
      {empty ? (
        <p className="rounded-md bg-muted px-3 py-2 text-caption text-muted-foreground">
          {p.warehouseEmpty}{' '}
          <Link href={routes.settings.store()} className="font-medium text-foreground underline">
            {p.warehouseEmptyLink}
          </Link>
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        {text('name', p.warehouseName, false)}
        <Field>
          <FieldLabel htmlFor="wh-phone">{p.phone}</FieldLabel>
          <Input
            id="wh-phone"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            value={value.phone}
            onChange={(e) => set('phone', e.target.value)}
          />
        </Field>
        {text('line1', p.line1, true)}
        {text('line2', p.line2, true)}
        {text('city', p.city, false)}
        <Field>
          <FieldLabel htmlFor="wh-state">{p.state}</FieldLabel>
          <Select
            items={items}
            value={value.state || null}
            onValueChange={(code) => code && set('state', String(code))}
          >
            <SelectTrigger id="wh-state" className="w-full">
              <SelectValue placeholder={p.statePlaceholder} />
            </SelectTrigger>
            <SelectContent>
              {items.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
    </section>
  )
}
