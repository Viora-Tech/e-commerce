import { catalogueApps, catalogueCategories } from '@commerce/core/app-catalogue'
import CtaBand from '@/components/common/cta-band'
import JsonLd from '@/components/common/json-ld'
import PageContainer from '@/components/common/page-container'
import SectionHeading from '@/components/common/section-heading'
import SiteShell from '@/components/layout/site-shell'
import AppDirectory from '@/components/pages/app-directory'
import { appsContent as copy } from '@/data/apps'
import { pageMetadata } from '@/lib/metadata'
import { appListLd, breadcrumbLd } from '@/lib/seo'

export const metadata = pageMetadata({
  title: copy.metaTitle,
  description: copy.metaDescription,
  path: '/apps',
})

export default function AppsPage() {
  // Render logic
  const apps = catalogueApps()

  return (
    <SiteShell>
      <JsonLd data={breadcrumbLd([{ name: copy.metaTitle, path: '/apps' }])} />
      <JsonLd data={appListLd(copy.metaTitle, apps)} />
      <PageContainer as="section" className="pt-20 pb-10 md:pt-28 md:pb-14">
        <SectionHeading
          as="h1"
          size="display"
          eyebrow={copy.eyebrow}
          title={copy.title}
          subtitle={copy.subtitle}
        />
      </PageContainer>
      <AppDirectory apps={apps} categories={catalogueCategories(apps)} />
      <div className="mt-16 md:mt-24">
        <CtaBand title={copy.cta.title} body={copy.cta.body} inline />
      </div>
    </SiteShell>
  )
}
