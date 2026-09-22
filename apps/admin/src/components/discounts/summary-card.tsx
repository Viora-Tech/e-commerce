import { describeDiscountValue } from '@commerce/core/discounts'
import { Card, CardContent, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { discountFormContent } from '@/data/discounts'
import { formatPaise } from '@/lib/money'
import type { DiscountFormState, LoadedDiscount } from './form-state'
import { toInput } from './form-state'

type SummaryCardProps = {
  form: DiscountFormState
  discount: LoadedDiscount | null
}

const copy = discountFormContent.summary
const dateFmt = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

function fmt(s: string): string | null {
  if (!s) return null
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : dateFmt.format(d)
}

/** Sentences describing the discount as the merchant builds it, like Shopify's side card. */
function detailLines(form: DiscountFormState, discount: LoadedDiscount | null): string[] {
  const input = toInput(form)
  const lines: string[] = []
  lines.push(form.appliesTo === 'products' ? copy.forSome(form.productIds.length) : copy.forAll)
  lines.push(
    input.minSubtotalPaise ? copy.minimum(formatPaise(input.minSubtotalPaise)) : copy.noMinimum,
  )
  lines.push(copy.usesLeft(discount?.usedCount ?? 0, input.usageLimit ?? null))
  if (form.onePerCustomer) lines.push(copy.onePerCustomer)
  const start = fmt(form.startsAt)
  const end = form.hasEnd ? fmt(form.endsAt) : null
  const active = start ? copy.activeFrom(start) : copy.activeNow
  lines.push(end ? `${active} ${copy.activeUntil(end)}` : active)
  return lines
}

export default function SummaryCard({ form, discount }: SummaryCardProps) {
  // Render logic
  const input = toInput(form)
  const title = form.title.trim() || copy.untitled
  const code =
    form.kind === 'automatic' ? copy.automatic : form.code.trim().toUpperCase() || copy.noCode
  const valueText =
    form.method === 'free_shipping' || Number.isFinite(input.value)
      ? describeDiscountValue({ method: form.method, value: input.value || 0 })
      : null

  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.heading}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div>
          <p className="text-body-strong">{title}</p>
          <p className="font-mono text-caption uppercase tracking-wide">{code}</p>
        </div>
        <div>
          <p className="text-caption">{copy.typeAndMethod}</p>
          <p className="text-body">
            {discountFormContent.method.kinds[form.kind].label}
            {valueText ? `, ${valueText.toLowerCase()}` : ''}
          </p>
        </div>
        <div>
          <p className="text-caption">{copy.details}</p>
          <ul className="list-disc pl-4 text-body">
            {detailLines(form, discount).map((line) => (
              <li key={line}>{line}</li>
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
      </CardContent>
    </Card>
  )
}
