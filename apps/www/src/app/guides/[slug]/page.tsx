import { ArrowRight_ as ArrowRight } from '@commerce/ui/icons'
import { buttonVariants } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import CtaBand from '@/components/common/cta-band'
import JsonLd from '@/components/common/json-ld'
import PageContainer from '@/components/common/page-container'
import SiteShell from '@/components/layout/site-shell'
import { guidesContent as copy, formatGuideDate, GUIDES, guideBySlug } from '@/data/guides'
import { solutionsContent } from '@/data/solutions'
import { pageMetadata } from '@/lib/metadata'
import { articleLd, breadcrumbLd } from '@/lib/seo'

type PageProps = { params: Promise<{ slug: string }> }

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }))
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params
  const guide = guideBySlug(slug)
  const base = pageMetadata({
    title: guide?.title ?? copy.eyebrow,
    description: guide?.description ?? copy.metaDescription,
    path: `/guides/${slug}`,
  })
  return guide
    ? {
        ...base,
        openGraph: {
          ...base.openGraph,
          type: 'article' as const,
          publishedTime: guide.published,
          modifiedTime: guide.updated,
        },
      }
    : base
}

export default async function GuidePage({ params }: PageProps) {
  const { slug } = await params
  const guide = guideBySlug(slug)
  if (!guide) notFound()
  const path = `/guides/${guide.slug}`

  return (
    <SiteShell>
      <JsonLd
        data={[
          articleLd({ ...guide, path }),
          breadcrumbLd([
            { name: copy.eyebrow, path: '/guides' },
            { name: guide.title, path },
          ]),
        ]}
      />
      <PageContainer className="pt-16 pb-16 md:pt-24">
        <article className="mx-auto flex max-w-[45rem] flex-col gap-10">
          <header className="flex flex-col gap-5">
            <nav
              aria-label="Breadcrumb"
              className="flex items-center gap-2 text-sm text-muted-foreground"
            >
              <Link href="/guides" className="hover:text-foreground">
                {copy.eyebrow}
              </Link>
            </nav>
            <h1 className="text-4xl font-semibold text-balance text-foreground md:text-5xl">
              {guide.title}
            </h1>
            <p className="text-lead text-pretty text-muted-foreground">{guide.description}</p>
            <p className="text-sm text-muted-foreground">
              <time dateTime={guide.updated}>{copy.updated(formatGuideDate(guide.updated))}</time>
              {' · '}
              {copy.minutes(guide.readMinutes)}
            </p>
          </header>
          {guide.sections.map((section) => (
            <section key={section.heading} className="flex flex-col gap-4">
              <h2 className="text-2xl font-semibold text-foreground">{section.heading}</h2>
              {section.paragraphs.map((p) => (
                <p key={p} className="text-base leading-7 text-pretty text-muted-foreground">
                  {p}
                </p>
              ))}
              {section.bullets ? (
                <ul className="flex list-disc flex-col gap-2 pl-5 text-base text-muted-foreground">
                  {section.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
          <footer className="surface-card flex flex-col gap-3 rounded-2xl p-6 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm text-muted-foreground">{copy.next}</span>
            <a
              href={guide.next.href}
              className={buttonVariants({ variant: 'outline', size: 'lg' })}
            >
              <ArrowRight aria-hidden />
              {guide.next.label}
            </a>
          </footer>
        </article>
      </PageContainer>
      <CtaBand title={solutionsContent.cta.title} body={solutionsContent.cta.body} inline />
    </SiteShell>
  )
}
