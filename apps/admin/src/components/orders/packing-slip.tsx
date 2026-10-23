/* oxlint-disable shadcn/no-raw-colors -- printed page: always black on white, never themed. */
import { orderDetailContent } from '@/data/order-detail'
import { useCopy, useFormat } from '@/hooks/use-copy'
import type { OrderDetail } from './order-detail-types'

type PackingSlipProps = {
  order: OrderDetail
}

/** Hidden on screen; `window.print()` shows only this block (see globals.css). */
export default function PackingSlip({ order }: PackingSlipProps) {
  // Hooks
  const copy = useCopy(orderDetailContent)
  const fmt = useFormat()

  const a = order.shippingAddress
  return (
    <section className="packing-slip hidden print:block">
      <h1 className="text-xl font-semibold">{copy.print.title}</h1>
      <p className="text-base font-medium">{copy.title(order.number)}</p>
      <p className="text-sm">
        {copy.placed(new Date(order.placedAt).toLocaleDateString(fmt.intl))}
      </p>
      {a ? (
        <address className="mt-4 not-italic text-sm">
          <p className="font-medium">{copy.print.shipTo}</p>
          <p>{a.name}</p>
          <p>{a.line1}</p>
          {a.line2 ? <p>{a.line2}</p> : null}
          <p>
            {a.city}, {a.stateCode} {a.pincode}
          </p>
          {a.phone ? <p>{a.phone}</p> : null}
        </address>
      ) : null}
      <table className="mt-6 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-black text-left">
            <th className="py-1">{copy.items.heading}</th>
            <th className="py-1">{copy.items.sku}</th>
            <th className="py-1 text-right">{copy.print.qty}</th>
          </tr>
        </thead>
        <tbody>
          {order.lines.map((l) => (
            <tr key={l.id} className="border-b border-neutral-300">
              <td className="py-1">
                {l.title}
                {l.variantTitle && l.variantTitle !== 'Default' ? `, ${l.variantTitle}` : ''}
              </td>
              <td className="py-1">{l.sku ?? ''}</td>
              <td className="py-1 text-right">{l.quantity}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
