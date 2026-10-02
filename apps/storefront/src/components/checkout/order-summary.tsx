import { formatPaise } from '@commerce/blocks'
import type { order, orderLine } from '@commerce/db'
import { formatSignedMoney } from '@commerce/money'
import SummaryLine from '@/components/checkout/summary-line'
import SummaryRow from '@/components/checkout/summary-row'
import { checkoutContent, thankYouContent as content } from '@/data/checkout'

type OrderSummaryProps = {
  order: typeof order.$inferSelect
  lines: (typeof orderLine.$inferSelect)[]
  /** Variant images by variant id; lines without one draw their initial. */
  images: Record<string, string>
  giftCards: { id: string; last: string; amountPaise: number }[]
}

/** The thank-you page's left column: what was bought and what it came to, as charged. */
export default function OrderSummary({ order: o, lines, images, giftCards }: OrderSummaryProps) {
  return (
    <div className="flex flex-col gap-7 lg:gap-9">
      <div className="hidden flex-col gap-1.5 lg:flex">
        <p className="text-[0.875rem] font-medium text-ck-summary-muted">
          {content.orderNumber(o.number)}
        </p>
        <p className="text-[2.5rem] leading-none font-semibold tracking-[-0.025em] tabular-nums">
          {formatPaise(o.totalPaise)}
        </p>
      </div>
      <section aria-label={content.summary} className="flex flex-col gap-7">
        <ul className="flex flex-col gap-5">
          {lines.map((l) => (
            <SummaryLine
              key={l.id}
              title={l.title ?? ''}
              variant={content.variantTitle(l.variantTitle)}
              quantity={l.quantity}
              linePaise={l.quantity * l.unitPricePaise}
              imageUrl={l.variantId ? (images[l.variantId] ?? null) : null}
            />
          ))}
        </ul>
        <dl className="flex flex-col gap-3 border-t border-ck-summary-line pt-6">
          <SummaryRow label={content.subtotal} value={formatPaise(o.subtotalPaise)} />
          {o.discountPaise > 0 ? (
            <SummaryRow
              tone="saving"
              label={o.discountLabel ?? content.discount}
              value={`−${formatPaise(o.discountPaise)}`}
            />
          ) : null}
          {o.shippingPaise > 0 || o.shippingRateName ? (
            <SummaryRow
              label={content.shippingRow(o.shippingRateName)}
              value={o.shippingPaise > 0 ? formatPaise(o.shippingPaise) : content.shippingFree}
            />
          ) : null}
          {o.paymentAdjustmentPaise !== 0 ? (
            <SummaryRow
              label={
                o.paymentAdjustmentLabel ?? content.adjustmentFallback(o.paymentAdjustmentPaise)
              }
              value={formatSignedMoney(o.paymentAdjustmentPaise)}
            />
          ) : null}
          <div className="mt-2! border-t border-ck-summary-line pt-4">
            <SummaryRow
              tone="total"
              label={
                <span className="flex flex-col gap-0.5">
                  {content.total}
                  <span className="text-[0.75rem] font-normal text-ck-summary-muted">
                    {checkoutContent.taxes}
                  </span>
                </span>
              }
              value={formatPaise(o.totalPaise)}
            />
          </div>
          {giftCards.map((g) => (
            <SummaryRow
              key={g.id}
              tone="saving"
              label={content.giftCardPaid(g.last)}
              value={`−${formatPaise(g.amountPaise)}`}
            />
          ))}
        </dl>
      </section>
    </div>
  )
}
