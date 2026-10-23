import { catalogueApp, catalogueApps, relatedApps } from '@commerce/core/app-catalogue'
import { CheckIcon } from '@commerce/ui/icons'
import { notFound } from 'next/navigation'
import AppAccess from '@/components/apps/app-access'
import AppCard from '@/components/apps/app-card'
import AppFacts from '@/components/apps/app-facts'
import AppHeader from '@/components/apps/app-header'
import AppShowcase from '@/components/apps/app-showcase'
import AppStickyBar from '@/components/apps/app-sticky-bar'
import AppTile from '@/components/apps/app-tile'
import InstallActions from '@/components/apps/install-actions'
import FaqList from '@/components/common/faq-list'
import JsonLd from '@/components/common/json-ld'
import PageContainer from '@/components/common/page-container'
import SiteShell from '@/components/layout/site-shell'
import {
  appFaq,
  appPath,
  categoryCopy,
  categoryPath,
  appsContent as copy,
  priceChip,
} from '@/data/apps'
import { pageMetadata } from '@/lib/metadata'
import { appLd, breadcrumbLd, faqLd } from '@/lib/seo'

type PageProps = { params: Promise<{ id: string }> }

export const dynamicParams = false

export function generateStaticParams() {
  return catalogueApps().map((a) => ({ id: a.id }))
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params
  const app = catalogueApp(id)
  return pageMetadata({
    title: app ? copy.appMetaTitle(app.name) : copy.metaTitle,
    description: app?.description ?? copy.metaDescription,
    path: appPath(id),
  })
}

const ACTIONS_ID = 'app-actions'

/**
 * One app: header with Install, a drawing of what it adds, what it does, what it can access,
 * its price and details, questions, and related apps. A compact Install bar follows the scroll.
 */
export default async function AppPage({ params }: PageProps) {
  const { id } = await params
  const app = catalogueApp(id)
  if (!app) notFound()

  // Render logic
  const related = relatedApps(app)
  const faq = appFaq(app)

  return (
    <SiteShell>
      <JsonLd
        data={breadcrumbLd([
          { name: copy.metaTitle, path: '/apps' },
          { name: categoryCopy(app.category).label, path: categoryPath(app.category) },
          { name: app.name, path: appPath(app.id) },
        ])}
      />
      <JsonLd data={appLd(app)} />
      <JsonLd data={faqLd(faq)} />

      <AppHeader app={app} actionsId={ACTIONS_ID} />
      <AppStickyBar
        watch={ACTIONS_ID}
        name={app.name}
        price={priceChip(app.price)}
        tile={
          <AppTile
            id={app.id}
            name={app.name}
            icon={app.icon}
            ours={app.kind === 'builtin'}
            size="sm"
          />
        }
        actions={<InstallActions id={app.id} guide={app.guide} size="md" docs={false} />}
      />

      <PageContainer className="flex flex-col gap-16 pt-12 pb-20 md:gap-24 md:pt-16 md:pb-28">
        <AppShowcase app={app} />

        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-16">
          <div className="flex min-w-0 flex-col gap-16 md:gap-20">
            <section aria-labelledby="does-title" className="flex flex-col gap-6">
              <h2 id="does-title" className="text-2xl font-semibold tracking-tight text-foreground">
                {copy.does}
              </h2>
              <p className="max-w-2xl text-xl leading-relaxed text-pretty text-foreground md:text-2xl md:leading-snug">
                {app.description}
              </p>
              <ul className="grid gap-3 sm:grid-cols-2">
                {app.highlights.map((line) => (
                  <li
                    key={line}
                    className="flex gap-3 rounded-[1.25rem] p-5 ring-1 ring-border ring-inset"
                  >
                    <CheckIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-foreground" />
                    <span className="text-sm text-pretty text-foreground">{line}</span>
                  </li>
                ))}
              </ul>
            </section>

            <AppAccess app={app} />

            <section aria-labelledby="faq-title" className="flex flex-col gap-2">
              <h2 id="faq-title" className="text-2xl font-semibold tracking-tight text-foreground">
                {copy.faq}
              </h2>
              <FaqList items={faq} />
            </section>
          </div>

          <AppFacts app={app} className="lg:sticky lg:top-36 lg:self-start" />
        </div>

        {related.length > 0 ? (
          <section aria-labelledby="related-title" className="flex flex-col gap-6">
            <h2
              id="related-title"
              className="text-2xl font-semibold tracking-tight text-foreground"
            >
              {copy.related}
            </h2>
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((other) => (
                <li key={other.id}>
                  <AppCard app={other} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </PageContainer>
    </SiteShell>
  )
}
