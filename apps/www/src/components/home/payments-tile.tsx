import { homeContent } from '@/data/home'
import BentoTile from './bento-tile'
import PaymentMethodDemo from './payment-method-demo'

const copy = homeContent.india.payments

/** The payments card: a live mini checkout that steps through every way to pay. */
export default function PaymentsTile() {
  return (
    <BentoTile
      eyebrow={copy.eyebrow}
      title={copy.title}
      body={copy.body}
      className="min-h-[34rem] lg:col-span-2 lg:min-h-[39rem]"
    >
      <PaymentMethodDemo />
    </BentoTile>
  )
}
