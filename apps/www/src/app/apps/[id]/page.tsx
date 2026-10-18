import { ArrowLeft, CheckIcon } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import JsonLd from '@/components/common/json-ld'
import PageContainer from '@/components/common/page-container'
import SiteShell from '@/components/layout/site-shell'
import { appsContent as copy, installUrl, STORE_APPS } from '@/data/apps'
import { pageMetadata } from '@/lib/metadata'
import { breadcrumbLd } from '@/lib/seo'

type PageProps = { params: Promise<{ id: string }> }

export function generateStaticParams() {
  return STORE_APPS.map((a) => ({ id: a.id }))
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params
  const app = STORE_APPS.find((a) => a.id === id)
  return pageMetadata({
    title: app ? app.name : 'App',
    description: app?.blurb ?? copy.subtitle,
    path: `/apps/${id}`,
  })
}

/** One app: what it does, what it can access and share, its price, and Install. */
export default async function AppPage({ params }: PageProps) {
  const { id } = await params
  const app = STORE_APPS.find((a) => a.id === id)
  if (!app) notFound()

  const sections = [
    { title: copy.does, items: app.does },
    { title: copy.access, items: app.access },
    { title: copy.shares, items: [app.shares ?? copy.sharesNothing] },
  ]

  return (
    <SiteShell>
      <JsonLd
        data={breadcrumbLd([
          { name: 'App Store', path: '/apps' },
          { name: app.name, path: `/apps/${app.id}` },
        ])}
      />
      <PageContainer as="section" className="flex max-w-3xl flex-col gap-8 pt-16 pb-20 md:pt-24">
        <Link
          href="/apps"
          className="inline-flex items-center gap-1.5 self-start text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {copy.back}
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="flex items-center gap-4">
            <span
              aria-hidden
              className="inline-flex size-14 shrink-0 items-center justify-center rounded-2xl border border-border bg-card text-lg font-semibold"
            >
              {app.name.slice(0, 2)}
            </span>
            <div className="flex flex-col gap-1">
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">{app.name}</h1>
              <p className="text-sm text-muted-foreground">{copy.by(app.by)}</p>
            </div>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
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
        </div>
        <p className="text-lg text-muted-foreground">{app.blurb}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {sections.map((s) => (
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
          <section className="surface-card flex flex-col gap-3 rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-foreground">{copy.price}</h2>
            <p className="text-sm text-muted-foreground">
              {app.pricing.kind === 'free'
                ? copy.priceFree
                : copy.pricePaid(app.pricing.perMonth, app.pricing.includedFrom)}
            </p>
            {app.guide ? (
              <a
                href={app.guide}
                className="text-sm font-medium text-foreground underline-offset-2 hover:underline"
              >
                {copy.guide}
              </a>
            ) : null}
          </section>
        </div>
      </PageContainer>
    </SiteShell>
  )
}
