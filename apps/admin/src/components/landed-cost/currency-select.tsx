'use client'

import type { PurchaseCurrency } from '@commerce/core/inventory'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { PURCHASE_CURRENCY_CODES } from '@/data/purchasing'

type CurrencySelectProps = {
  id: string
  value: PurchaseCurrency
  onChange: (currency: PurchaseCurrency) => void
  disabled?: boolean
  className?: string
}

const ITEMS = Object.fromEntries(PURCHASE_CURRENCY_CODES.map((c) => [c, c]))

/** One of the currencies a purchase can be priced in (INR, USD, CNY, ...). */
export default function CurrencySelect({
  id,
  value,
  onChange,
  disabled,
  className,
}: CurrencySelectProps) {
  return (
    <Select
      items={ITEMS}
      value={value}
      disabled={disabled}
      onValueChange={(next) => onChange(String(next) as PurchaseCurrency)}
    >
      <SelectTrigger id={id} className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PURCHASE_CURRENCY_CODES.map((c) => (
          <SelectItem key={c} value={c}>
            {c}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
