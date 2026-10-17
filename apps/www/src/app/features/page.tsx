import CtaBand from '@/components/common/cta-band'
import PageContainer from '@/components/common/page-container'
import SectionHeading from '@/components/common/section-heading'
import SiteShell from '@/components/layout/site-shell'
import FeatureExplorer from '@/components/pages/feature-explorer'
import { featuresContent as copy } from '@/data/features'
import { pageMetadata } from '@/lib/metadata'

export const metadata = pageMetadata({
  title: 'Features',
  description:
    'Fourteen modules in one admin: orders, products, stock, customers, analytics, growth, discounts, checkout, shipping, GST and more. No app store hunting.',
  path: '/features',
})

export default function FeaturesPage() {
  return (
    <SiteShell>
      <PageContainer as="section" className="pt-20 pb-10 md:pt-28 md:pb-14">
        <SectionHeading
          as="h1"
          size="display"
          eyebrow={copy.eyebrow}
          title={copy.title}
          subtitle={copy.subtitle}
        />
      </PageContainer>
      <FeatureExplorer />
      <div className="mt-16 md:mt-24">
        <CtaBand title={copy.cta.title} body={copy.cta.body} inline />
      </div>
    </SiteShell>
  )
}
