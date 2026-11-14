import { formatPaise } from '@commerce/blocks'
import type { ShopperOrderDetail } from '@commerce/core'
import { gstRowsToShow } from '@commerce/core/gst'
import { accountContent } from '@/data/account'
import { ACCOUNT_CARD, ACCOUNT_CARD_TITLE } from '@/lib/account-classes'

type OrderSummaryCardProps = {
  order: ShopperOrderDetail
}

const copy = accountContent.order
const card = ACCOUNT_CARD
const title = ACCOUNT_CARD_TITLE
const row = 'flex justify-between gap-4 text-[0.9375rem] tabular-nums'

const signed = (paise: number) => `${paise < 0 ? '−' : '+'}${formatPaise(Math.abs(paise))}`

/** The order page's money: subtotal, discount, shipping, payment fee, total and the GST split. */
export default function OrderSummaryCard({ order: o }: OrderSummaryCardProps) {
  // Render logic
  const gst = o.gst
  // Parcels from different states put both CGST + SGST and IGST on one order.
  const gstRows = gst ? gstRowsToShow(gst) : null

  return (
    <section className={card} aria-labelledby="order-summary">
      <h2 id="order-summary" className={title}>
        {copy.summary}
      </h2>
      <div className="flex flex-col gap-2">
        <div className={row}>
          <span>{copy.subtotal}</span>
          <span>{formatPaise(o.subtotalPaise)}</span>
        </div>
        {o.discountPaise > 0 ? (
          <div className={`${row} text-ck-success`}>
            <span>{o.discountLabel ?? copy.discount}</span>
            <span>−{formatPaise(o.discountPaise)}</span>
          </div>
        ) : null}
        <div className={row}>
          <span>{copy.shipping}</span>
          <span>{o.shippingPaise > 0 ? formatPaise(o.shippingPaise) : copy.shippingFree}</span>
        </div>
        {o.paymentAdjustmentPaise !== 0 ? (
          <div className={row}>
            <span>
              {o.paymentAdjustmentLabel ?? copy.adjustmentFallback(o.paymentAdjustmentPaise)}
            </span>
            <span>{signed(o.paymentAdjustmentPaise)}</span>
          </div>
        ) : null}
        <div className={`${row} mt-1 border-t border-ck-line pt-3 text-[1.0625rem]! font-semibold`}>
          <span>{copy.total}</span>
          <span>{formatPaise(o.totalPaise)}</span>
        </div>
        {gst && gst.taxPaise > 0 ? (
          <div className="flex flex-col gap-1 pt-1 text-[0.8125rem] text-ck-muted">
            <span>{copy.gstIncluded(formatPaise(gst.taxPaise))}</span>
            {gstRows?.intraState ? (
              <>
                <div className="flex justify-between">
                  <span>{copy.cgst(gst.ratePercent)}</span>
                  <span>{formatPaise(gst.cgstPaise)}</span>
                </div>
                <div className="flex justify-between">
                  <span>{copy.sgst(gst.ratePercent)}</span>
                  <span>{formatPaise(gst.sgstPaise)}</span>
                </div>
              </>
            ) : null}
            {gstRows?.interState ? (
              <div className="flex justify-between">
                <span>{copy.igst(gst.ratePercent)}</span>
                <span>{formatPaise(gst.igstPaise)}</span>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  )
}
