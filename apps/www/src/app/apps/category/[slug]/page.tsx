import { catalogueApps, catalogueCategories } from '@commerce/core/app-catalogue'
import { notFound } from 'next/navigation'
import CtaBand from '@/components/common/cta-band'
import JsonLd from '@/components/common/json-ld'
import PageContainer from '@/components/common/page-container'
import SectionHeading from '@/components/common/section-heading'
import SiteShell from '@/components/layout/site-shell'
import AppDirectory from '@/components/pages/app-directory'
import { categoryCopy, categoryPath, appsContent as copy } from '@/data/apps'
import { pageMetadata } from '@/lib/metadata'
import { appListLd, breadcrumbLd } from '@/lib/seo'

type PageProps = { params: Promise<{ slug: string }> }

export const dynamicParams = false

export function generateStaticParams() {
  return catalogueCategories().map((c) => ({ slug: c.slug }))
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params
  const words = categoryCopy(slug)
  return pageMetadata({
    title: words.title,
    description: words.description,
    path: categoryPath(slug),
  })
}

/** One App Store category as its own page, so each has a title and address search engines list. */
export default async function AppCategoryPage({ params }: PageProps) {
  const { slug } = await params
  const apps = catalogueApps()
  const categories = catalogueCategories(apps)
  if (!categories.some((c) => c.slug === slug)) notFound()

  // Render logic
  const words = categoryCopy(slug)
  const inCategory = apps.filter((a) => a.category === slug)

  return (
    <SiteShell>
      <JsonLd
        data={breadcrumbLd([
          { name: copy.metaTitle, path: '/apps' },
          { name: words.label, path: categoryPath(slug) },
        ])}
      />
      <JsonLd data={appListLd(words.title, inCategory)} />
      <PageContainer as="section" className="pt-20 pb-10 md:pt-28 md:pb-14">
        <SectionHeading
          as="h1"
          size="display"
          eyebrow={copy.eyebrow}
          title={words.title}
          subtitle={words.description}
        />
      </PageContainer>
      <AppDirectory apps={apps} categories={categories} category={slug} />
      <div className="mt-16 md:mt-24">
        <CtaBand title={copy.cta.title} body={copy.cta.body} inline />
      </div>
    </SiteShell>
  )
}
