import { siteConfig } from '@commerce/config/site'
import CtaBand from '@/components/common/cta-band'
import JsonLd from '@/components/common/json-ld'
import PageContainer from '@/components/common/page-container'
import SectionHeading from '@/components/common/section-heading'
import SiteShell from '@/components/layout/site-shell'
import AddOns from '@/components/pricing/add-ons'
import CompareTable from '@/components/pricing/compare-table'
import PricingExplorer from '@/components/pricing/pricing-explorer'
import PricingFaq from '@/components/pricing/pricing-faq'
import { pricingContent } from '@/data/pricing'
import { pageMetadata } from '@/lib/metadata'
import { breadcrumbLd, faqLd, softwareLd } from '@/lib/seo'

const copy = pricingContent.page

export const metadata = pageMetadata({
  title: 'Pricing',
  description: `${Object.values(siteConfig.plans)
    .map((p) => `${p.name} ₹${p.monthlyInr.toLocaleString('en-IN')}`)
    .join(
      ', ',
    )} a month before GST. A small fee per order only past your included orders, none on ${siteConfig.plans.scale.name}; every store starts with ${siteConfig.trialDays} days of Growth free.`,
  path: '/pricing',
})

export default function PricingPage() {
  return (
    <SiteShell>
      <JsonLd
        data={[
          softwareLd(),
          faqLd(copy.faq.columns.flat()),
          breadcrumbLd([{ name: copy.eyebrow, path: '/pricing' }]),
        ]}
      />
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
