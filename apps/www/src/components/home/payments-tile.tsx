import { homeContent } from '@/data/home'
import BentoTile from './bento-tile'
import OrderSummaryCard from './order-summary-card'
import PaymentMethodDemo from './payment-method-demo'

const copy = homeContent.india.payments

/** The payments card: a live mini checkout that steps through every way to pay, beside its order. */
export default function PaymentsTile() {
  return (
    <BentoTile eyebrow={copy.eyebrow} title={copy.title} body={copy.body} className="md:col-span-2">
      <div className="grid flex-1 gap-4 sm:grid-cols-[minmax(0,1fr)_15rem]">
        <PaymentMethodDemo />
        <OrderSummaryCard />
      </div>
    </BentoTile>
  )
}
