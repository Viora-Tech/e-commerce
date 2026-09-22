'use client'

import { Field, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import MoneyInput from '@/components/fields/money-input'
import { customersContent } from '@/data/customers'
import { INDIAN_STATES } from '@/data/india'

export type CustomerFilterState = {
  stateCode: string
  minSpend: string
  maxSpend: string
  minOrders: string
  marketing: string
  tag: string
}

type CustomerFiltersProps = {
  value: CustomerFilterState
  tags: string[]
  onChange: (patch: Partial<CustomerFilterState>) => void
}

export const EMPTY_CUSTOMER_FILTERS: CustomerFilterState = {
  stateCode: '',
  minSpend: '',
  maxSpend: '',
  minOrders: '',
  marketing: '',
  tag: '',
}

const ANY = '__any'
const copy = customersContent.filters
const stateItems = [
  { value: ANY, label: copy.anyState },
  ...INDIAN_STATES.map((s) => ({ value: s.code, label: s.name })),
]
const marketingItems = [
  { value: ANY, label: copy.marketingAny },
  { value: 'yes', label: copy.marketingYes },
  { value: 'no', label: copy.marketingNo },
]

/** Contents of the filter popover on the customer list. */
export default function CustomerFilters({ value, tags, onChange }: CustomerFiltersProps) {
  // Render logic
  const tagItems = [
    { value: ANY, label: copy.anyTag },
    ...tags.map((t) => ({ value: t, label: t })),
  ]

  return (
    <FieldGroup className="gap-4">
      <Field>
        <FieldLabel htmlFor="filter-state">{copy.state}</FieldLabel>
        <Select
          items={stateItems}
          value={value.stateCode || ANY}
          onValueChange={(v) => onChange({ stateCode: String(v) === ANY ? '' : String(v ?? '') })}
        >
          <SelectTrigger id="filter-state" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {stateItems.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field>
          <FieldLabel htmlFor="filter-min-spend">{copy.minSpend}</FieldLabel>
          <MoneyInput
            id="filter-min-spend"
            value={value.minSpend}
            onChange={(minSpend) => onChange({ minSpend })}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="filter-max-spend">{copy.maxSpend}</FieldLabel>
          <MoneyInput
            id="filter-max-spend"
            value={value.maxSpend}
            onChange={(maxSpend) => onChange({ maxSpend })}
          />
        </Field>
      </div>

      <Field>
        <FieldLabel htmlFor="filter-orders">{copy.orders}</FieldLabel>
        <Input
          id="filter-orders"
          inputMode="numeric"
          value={value.minOrders}
          onChange={(e) => onChange({ minOrders: e.target.value })}
        />
      </Field>

      <Field>
        <FieldLabel htmlFor="filter-marketing">{copy.marketing}</FieldLabel>
        <Select
          items={marketingItems}
          value={value.marketing || ANY}
          onValueChange={(v) => onChange({ marketing: String(v) === ANY ? '' : String(v ?? '') })}
        >
          <SelectTrigger id="filter-marketing" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {marketingItems.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {tags.length > 0 ? (
        <Field>
          <FieldLabel htmlFor="filter-tag">{copy.tag}</FieldLabel>
          <Select
            items={tagItems}
            value={value.tag || ANY}
            onValueChange={(v) => onChange({ tag: String(v) === ANY ? '' : String(v ?? '') })}
          >
            <SelectTrigger id="filter-tag" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {tagItems.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      ) : null}
    </FieldGroup>
  )
}
