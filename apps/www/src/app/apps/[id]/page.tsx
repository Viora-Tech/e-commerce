import { catalogueApp, catalogueApps, relatedApps } from '@commerce/core/app-catalogue'
import { ArrowLeft, CheckIcon } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import AppAccess from '@/components/apps/app-access'
import AppCard from '@/components/apps/app-card'
import AppFacts from '@/components/apps/app-facts'
import AppTile from '@/components/apps/app-tile'
import JsonLd from '@/components/common/json-ld'
import PageContainer from '@/components/common/page-container'
import SiteShell from '@/components/layout/site-shell'
import {
  appPath,
  byline,
  categoryCopy,
  categoryPath,
  appsContent as copy,
  installUrl,
  priceChip,
} from '@/data/apps'
import { pageMetadata } from '@/lib/metadata'
import { appLd, breadcrumbLd } from '@/lib/seo'

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

/** "Works with": the manifest's notes, the outside account a connection needs, and what it adds. */
function worksWith(app: NonNullable<ReturnType<typeof catalogueApp>>): string[] {
  return [
    ...(app.kind === 'connection' && app.company ? [copy.needsAccount(app.company)] : []),
    ...app.worksWith,
  ]
}

/** One app: what it does, what it works with, what it can access and share, its price, and Install. */
export default async function AppPage({ params }: PageProps) {
  const { id } = await params
  const app = catalogueApp(id)
  if (!app) notFound()

  // Render logic
  const related = relatedApps(app)
  const pairs = worksWith(app)
  const extras = [
    ...(app.adminPages.length > 0 ? [{ title: copy.adds, items: app.adminPages }] : []),
    ...(app.themeBlocks.length > 0 ? [{ title: copy.blocks, items: app.themeBlocks }] : []),
  ]

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
      <PageContainer as="section" className="flex flex-col gap-10 pt-16 pb-20 md:pt-24">
        <Link
          href="/apps"
          className="inline-flex items-center gap-1.5 self-start text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {copy.back}
        </Link>

        <header className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4">
            <AppTile id={app.id} name={app.name} size="lg" />
            <div className="flex min-w-0 flex-col gap-1.5">
              <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
                {app.name}
              </h1>
              <p className="text-sm text-muted-foreground">
                {byline(app)} · {priceChip(app.price)}
              </p>
              <p className="max-w-2xl text-lg text-muted-foreground">{app.tagline}</p>
            </div>
          </div>
          <div className="flex flex-col items-start gap-2 md:max-w-xs md:items-end md:text-right">
            <Button size="lg" nativeButton={false} render={<a href={installUrl(app.id)} />}>
              {copy.install}
            </Button>
            <p className="text-xs text-muted-foreground">{copy.installHint}</p>
            <p className="text-xs text-muted-foreground">
              {copy.noStore}{' '}
              <Link
                href="/waitlist"
                className="font-medium text-foreground underline-offset-2 hover:underline"
              >
                {copy.joinWaitlist}
              </Link>
            </p>
          </div>
        </header>

        {app.screenshots.length > 0 ? (
          <section
            aria-label={copy.screenshots}
            className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0"
          >
            <ul className="flex snap-x snap-mandatory gap-4">
              {app.screenshots.map((shot) => (
                <li key={shot.src} className="w-[85%] shrink-0 snap-start md:w-[48%]">
                  {/* biome-ignore lint/performance/noImgElement: static export, images ship as they are */}
                  <img
                    src={shot.src}
                    alt={shot.alt}
                    loading="lazy"
                    decoding="async"
                    className="aspect-video w-full rounded-2xl border border-border object-cover"
                  />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="flex flex-col gap-6">
            <p className="text-base text-muted-foreground">{app.description}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { title: copy.does, items: app.highlights },
                ...(pairs.length > 0 ? [{ title: copy.worksWith, items: pairs }] : []),
                ...extras,
              ].map((s) => (
                <section key={s.title} className="surface-card flex flex-col gap-3 rounded-2xl p-5">
                  <h2 className="text-sm font-semibold text-foreground">{s.title}</h2>
                  <ul className="flex flex-col gap-2">
                    {s.items.map((item) => (
                      <li key={item} className="flex gap-2 text-sm text-muted-foreground">
                        <CheckIcon className="mt-0.5 size-4 shrink-0 text-foreground" aria-hidden />
                        {item}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
            <AppAccess app={app} />
          </div>
          <AppFacts app={app} />
        </div>

        {related.length > 0 ? (
          <section className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold text-foreground">{copy.related}</h2>
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
