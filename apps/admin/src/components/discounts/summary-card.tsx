'use client'

import { type DiscountInput, describeDiscountValue } from '@commerce/core/discounts'
import DataCard from '@/components/layout/data-card'
import { discountFormContent } from '@/data/discounts'
import { useCopy } from '@/hooks/use-copy'
import { formatPattern } from '@/lib/format-date'
import { formatPaise } from '@/lib/money'
import { toInput } from './form-input'
import { type DiscountFormState, fromLocalInput, type LoadedDiscount } from './form-state'

type SummaryCardProps = {
  form: DiscountFormState
  discount: LoadedDiscount | null
}

type Copy = (typeof discountFormContent)['summary']

const CLASSES = ['products', 'order', 'shipping'] as const

function fmt(s: string): string | null {
  const d = fromLocalInput(s)
  return d ? formatPattern(d, { day: 'numeric', month: 'short', year: 'numeric' }) : null
}

/** "₹200 off", or "₹200 to ₹300 off each item" once per-product amounts are typed. */
function describeValue(input: DiscountInput): string | null {
  if (input.method === 'free_shipping') return null
  const typed = Object.entries(input.productValues ?? {}).filter(([, v]) => Number.isFinite(v))
  if (input.productValues) {
    return typed.length > 0
      ? describeDiscountValue({ ...input, productValues: Object.fromEntries(typed) })
      : null
  }
  return Number.isFinite(input.value) && input.value > 0 ? describeDiscountValue(input) : null
}

/** What the discount gives and to what, per type. */
function scopeLines(copy: Copy, form: DiscountFormState, input: DiscountInput): string[] {
  if (form.type === 'products') {
    return [
      form.appliesTo === 'products'
        ? copy.forSome(form.productIds.length)
        : copy.forCollections(form.collectionIds.length),
    ]
  }
  if (form.type === 'bxgy' && input.bxgy) {
    const { buys, gets, maxUsesPerOrder } = input.bxgy
    const what =
      buys.kind === 'quantity'
        ? copy.buysItems(buys.quantity)
        : copy.buysSpend(formatPaise(buys.amountPaise))
    const off = input.method === 'percent' ? `${input.value / 100}%` : formatPaise(input.value)
    const how =
      form.getsMode === 'free'
        ? copy.getsFree
        : copy.getsOff(Number.isFinite(input.value) && input.value > 0 ? off : '…')
    const lines = [copy.buys(what), copy.gets(gets.quantity, how)]
    if (maxUsesPerOrder) lines.push(copy.perOrder(maxUsesPerOrder))
    return lines
  }
  if (form.type === 'combo') {
    const lines = (input.combos ?? []).map((c, i) => {
      const valid = Number.isFinite(c.value) && c.value > 0
      const how =
        c.method === 'price'
          ? copy.comboPrice(valid ? formatPaise(c.value) : '…')
          : copy.comboOff(
              valid ? (c.method === 'percent' ? `${c.value / 100}%` : formatPaise(c.value)) : '…',
            )
      return copy.combo(
        i + 1,
        c.items.reduce((n, it) => n + it.quantity, 0),
        how,
      )
    })
    lines.push(copy.comboEach)
    return lines
  }
  if (form.type === 'shipping') {
    const lines = [form.allStates ? copy.allStates : copy.someStates(form.shippingStates.length)]
    if (input.maxShippingPaise) lines.push(copy.rateCap(formatPaise(input.maxShippingPaise)))
    return lines
  }
  return [copy.forAll]
}

/** Sentences describing the discount as the merchant builds it, like Shopify's side card. */
function detailLines(
  copy: Copy,
  form: DiscountFormState,
  discount: LoadedDiscount | null,
): string[] {
  const input = toInput(form)
  const lines = scopeLines(copy, form, input)
  if (input.minSubtotalPaise) lines.push(copy.minimum(formatPaise(input.minSubtotalPaise)))
  else if (input.minQuantity) lines.push(copy.minQuantity(input.minQuantity))
  else if (form.type !== 'bxgy' && form.type !== 'combo') lines.push(copy.noMinimum)
  lines.push(
    form.eligibility === 'segments'
      ? copy.forSegments(form.segmentIds.length)
      : form.eligibility === 'customers'
        ? copy.forCustomers(form.customerIds.length)
        : copy.forEveryone,
  )
  lines.push(copy.usesLeft(discount?.usedCount ?? 0, input.usageLimit ?? null))
  if (form.onePerCustomer) lines.push(copy.onePerCustomer)
  const names = CLASSES.filter((c) => form.combinesWith[c]).map((c) => copy.combineNames[c])
  lines.push(names.length > 0 ? copy.combines(copy.combineJoin(names)) : copy.combinesNone)
  const start = fmt(form.startsAt)
  const end = form.hasEnd ? fmt(form.endsAt) : null
  const active = start ? copy.activeFrom(start) : copy.activeNow
  lines.push(end ? `${active} ${copy.activeUntil(end)}` : active)
  return lines
}

export default function SummaryCard({ form, discount }: SummaryCardProps) {
  // Hooks
  const all = useCopy(discountFormContent)

  // Render logic
  const copy = all.summary
  const input = toInput(form)
  const title = form.title.trim() || copy.untitled
  const code =
    form.kind === 'automatic' ? copy.automatic : form.code.trim().toUpperCase() || copy.noCode
  const valueText = form.type === 'bxgy' || form.type === 'combo' ? null : describeValue(input)

  return (
    <DataCard title={copy.heading} bodyClassName="flex flex-col gap-4">
      <div>
        <p className="text-body-strong">{title}</p>
        <p className="text-caption">{code}</p>
      </div>
      <div>
        <p className="text-caption">{copy.typeAndMethod}</p>
        <p className="text-body">
          {all.type.options[form.type].label}
          {valueText ? `, ${valueText.toLowerCase()}` : ''}
        </p>
      </div>
      <div>
        <p className="text-caption">{copy.details}</p>
        <ul className="list-disc pl-4 text-body">
          {detailLines(copy, form, discount).map((line, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: two combos can read the same; the position keeps keys apart
            <li key={`${i}-${line}`}>{line}</li>
          ))}
        </ul>
      </div>
      {discount ? (
        <div>
          <p className="text-caption">{copy.performance}</p>
          <p className="text-body">
            {copy.orders(discount.usage.orders)},{' '}
            {copy.amount(formatPaise(discount.usage.amountPaise))}
          </p>
        </div>
      ) : null}
    </DataCard>
  )
}
