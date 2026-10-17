import { ArrowRight_ as ArrowRight } from '@commerce/ui/icons'
import { buttonVariants } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { homeContent } from '@/data/home'
import { PLANS } from '@/data/pricing'
import AmbientLight from '../common/ambient-light'
import PageContainer from '../common/page-container'
import SectionHeading from '../common/section-heading'
import PlanCard from '../pricing/plan-card'

const copy = homeContent.pricing

export default function HomePricing() {
  return (
    <section id="pricing" className="relative isolate overflow-hidden py-20 md:py-32">
      <AmbientLight className="top-1/3 left-1/2 h-72 w-[48rem] max-w-full -translate-x-1/2" />
      <PageContainer className="flex flex-col items-center gap-12 md:gap-16">
        <SectionHeading eyebrow={copy.eyebrow} title={copy.title} subtitle={copy.subtitle} />
        <div className="grid w-full gap-6 lg:grid-cols-3">
          {PLANS.map((plan) => (
            <PlanCard key={plan.key} plan={plan} />
          ))}
        </div>
        <Link href="/pricing" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
          <ArrowRight aria-hidden />
          {copy.compare}
        </Link>
        <p className="text-center text-xs text-muted-foreground">{copy.note}</p>
      </PageContainer>
    </section>
  )
}
