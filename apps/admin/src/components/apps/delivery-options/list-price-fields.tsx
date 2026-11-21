'use client'

import type { DeliveryOption } from '@commerce/core/delivery-options'
import { parseRupees } from '@commerce/money'
import { useState } from 'react'
import { deliveryOptionsContent } from '@/data/delivery-options'
import { useCopy } from '@/hooks/use-copy'
import { toNumber, toRupees } from './format'
import NumberField from './number-field'
import RupeeField from './rupee-field'

type ListPriceFieldsProps = {
  option: DeliveryOption
  onChange: (next: DeliveryOption) => void
}

type Texts = { markup: string; percent: string; freeAbove: string; min: string; max: string }

/** The option's amounts as typed text, so "12." survives; the option keeps paise. */
const textsOf = (o: DeliveryOption): Texts => ({
  markup: toRupees(o.price.markupPaise || null),
  percent: o.price.markupPercent ? String(o.price.markupPercent) : '',
  freeAbove: toRupees(o.price.freeAbovePaise),
  min: toRupees(o.price.minPaise),
  max: toRupees(o.price.maxPaise),
})

/** One typed amount into the option's price. */
function priceWith(p: DeliveryOption['price'], key: keyof Texts, text: string) {
  if (key === 'markup') return { ...p, markupPaise: parseRupees(text) ?? 0 }
  if (key === 'percent') return { ...p, markupPercent: Math.min(100, toNumber(text) ?? 0) }
  if (key === 'freeAbove') return { ...p, freeAbovePaise: parseRupees(text) ?? null }
  if (key === 'min') return { ...p, minPaise: parseRupees(text) ?? null }
  return { ...p, maxPaise: parseRupees(text) ?? null }
}

/**
 * The courier list's price amounts in "More settings" (owner, 21 Nov 2026): markup in rupees and
 * percent (on the courier cost only), free above an order value, and the price limits. Free
 * delivery needs none of them, so they hide then.
 */
export default function ListPriceFields({ option, onChange }: ListPriceFieldsProps) {
  // Hooks
  const copy = useCopy(deliveryOptionsContent)
  const [texts, setTexts] = useState(() => textsOf(option))

  // Event handlers
  const handleText = (key: keyof Texts) => (text: string) => {
    setTexts((t) => ({ ...t, [key]: text }))
    onChange({ ...option, price: priceWith(option.price, key, text) })
  }

  // Early returns
  if (option.price.source === 'free') return null

  // Render logic
  const o = copy.option.price

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {option.price.source === 'route' ? (
        <>
          <RupeeField
            id="list-markup"
            label={o.markup}
            value={texts.markup}
            onChange={handleText('markup')}
          />
          <NumberField
            id="list-markup-pct"
            label={o.markupPercent}
            value={texts.percent}
            onChange={handleText('percent')}
            suffix="%"
          />
        </>
      ) : null}
      <RupeeField
        id="list-free-above"
        label={o.freeAbove}
        value={texts.freeAbove}
        onChange={handleText('freeAbove')}
      />
      <RupeeField id="list-min" label={o.min} value={texts.min} onChange={handleText('min')} />
      <RupeeField id="list-max" label={o.max} value={texts.max} onChange={handleText('max')} />
    </div>
  )
}
