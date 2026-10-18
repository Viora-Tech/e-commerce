import CtaBand from '@/components/common/cta-band'
import PageContainer from '@/components/common/page-container'
import SectionHeading from '@/components/common/section-heading'
import SiteShell from '@/components/layout/site-shell'
import AppDirectory from '@/components/pages/app-directory'
import { appsContent as copy } from '@/data/apps'
import { pageMetadata } from '@/lib/metadata'

export const metadata = pageMetadata({
  title: 'App Store',
  description:
    'Every app a store can add: GST invoices, couriers, payments, reviews, back in stock, analytics and more, with what each can access and what it costs.',
  path: '/apps',
})

export default function AppsPage() {
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
      <AppDirectory />
      <div className="mt-16 md:mt-24">
        <CtaBand title={copy.cta.title} body={copy.cta.body} inline />
      </div>
    </SiteShell>
  )
}
