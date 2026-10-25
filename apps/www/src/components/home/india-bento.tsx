import { homeContent } from '@/data/home'
import AmbientLight from '../common/ambient-light'
import PageContainer from '../common/page-container'
import SectionHeading from '../common/section-heading'
import CartRecoveryTile from './cart-recovery-tile'
import CouriersTile from './couriers-tile'
import GatewaysTile from './gateways-tile'
import GstTile from './gst-tile'
import HindiTile from './hindi-tile'
import PaymentsTile from './payments-tile'

const copy = homeContent.india

export default function IndiaBento() {
  return (
    <section className="relative isolate overflow-hidden py-20 md:py-32">
      <AmbientLight className="top-1/3 -left-24 h-96 w-[44rem]" />
      <AmbientLight className="right-0 bottom-0 h-96 w-[44rem]" />
      <PageContainer className="flex flex-col items-center gap-12 md:gap-16">
        <SectionHeading eyebrow={copy.eyebrow} title={copy.title} subtitle={copy.subtitle} />
        {/* Order and spans keep every row full: 1 column on phones, 2 on tablets
            (wide · pair · wide · pair) and 3 on desktop (2+1, 1+2, 1+2). */}
        <div className="grid w-full gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
          <PaymentsTile />
          <GstTile />
          <HindiTile />
          <CouriersTile />
          <CartRecoveryTile />
          <GatewaysTile />
        </div>
      </PageContainer>
    </section>
  )
}
