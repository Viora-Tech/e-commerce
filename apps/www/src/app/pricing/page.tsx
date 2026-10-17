import CtaBand from '@/components/common/cta-band'
import PageContainer from '@/components/common/page-container'
import SectionHeading from '@/components/common/section-heading'
import SiteShell from '@/components/layout/site-shell'
import AddOns from '@/components/pricing/add-ons'
import CompareTable from '@/components/pricing/compare-table'
import PricingExplorer from '@/components/pricing/pricing-explorer'
import PricingFaq from '@/components/pricing/pricing-faq'
import { pricingContent } from '@/data/pricing'
import { pageMetadata } from '@/lib/metadata'

const copy = pricingContent.page

export const metadata = pageMetadata({
  title: 'Pricing',
  description:
    'Plans by orders a month, with no cut of your sales. Compare Free, Growth and Scale. Prices are announced at launch.',
  path: '/pricing',
})

export default function PricingPage() {
  return (
    <SiteShell>
      <PageContainer as="section" className="pt-20 pb-12 md:pt-28 md:pb-16">
        <SectionHeading
          as="h1"
          size="display"
          eyebrow={copy.eyebrow}
          title={copy.title}
          subtitle={copy.subtitle}
        />
      </PageContainer>
      <PricingExplorer />
      <CompareTable />
      <AddOns />
      <PricingFaq />
      <CtaBand title={copy.cta.title} body={copy.cta.body} inline />
    </SiteShell>
  )
}
