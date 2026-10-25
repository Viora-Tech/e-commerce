import { catalogueApps, catalogueCategories } from '@commerce/core/app-catalogue'
import AppShelf from '@/components/apps/app-shelf'
import EssentialsStack from '@/components/apps/essentials-stack'
import CtaBand from '@/components/common/cta-band'
import JsonLd from '@/components/common/json-ld'
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
      <AppDirectory
        apps={apps}
        categories={catalogueCategories(apps)}
        title={copy.heroTitle}
        body={copy.heroBody(apps.length)}
        aside={<AppShelf apps={apps} />}
        featured={<EssentialsStack apps={apps} />}
      />
      <div className="mt-16 md:mt-24">
        <CtaBand title={copy.cta.title} body={copy.cta.body} inline />
      </div>
    </SiteShell>
  )
}
