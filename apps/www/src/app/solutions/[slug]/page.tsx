import { ArrowRight_ as ArrowRight, Download } from '@commerce/ui/icons'
import { buttonVariants } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import CtaBand from '@/components/common/cta-band'
import FaqList from '@/components/common/faq-list'
import JsonLd from '@/components/common/json-ld'
import PageContainer from '@/components/common/page-container'
import SectionHeading from '@/components/common/section-heading'
import SiteShell from '@/components/layout/site-shell'
import { solutionsContent as copy, SOLUTIONS, solutionBySlug } from '@/data/solutions'
import { pageMetadata } from '@/lib/metadata'
import { breadcrumbLd, faqLd } from '@/lib/seo'

type PageProps = { params: Promise<{ slug: string }> }

export function generateStaticParams() {
  return SOLUTIONS.map((s) => ({ slug: s.slug }))
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params
  const solution = solutionBySlug(slug)
  return pageMetadata({
    title: solution?.metaTitle ?? copy.eyebrow,
    description: solution?.description ?? copy.metaDescription,
    path: `/solutions/${slug}`,
  })
}

export default async function SolutionPage({ params }: PageProps) {
  const { slug } = await params
  const solution = solutionBySlug(slug)
  if (!solution) notFound()
  const related = solution.related
    .map(solutionBySlug)
    .filter((s): s is NonNullable<typeof s> => s !== undefined)

  return (
    <SiteShell>
      <JsonLd
        data={[
          breadcrumbLd([
            { name: copy.eyebrow, path: '/solutions' },
            { name: solution.metaTitle, path: `/solutions/${solution.slug}` },
          ]),
          faqLd(solution.faq),
        ]}
      />
      <PageContainer as="section" className="pt-20 pb-12 md:pt-28 md:pb-16">
        <nav
          aria-label="Breadcrumb"
          className="mb-8 flex items-center justify-center gap-2 text-sm text-muted-foreground"
        >
          <Link href="/solutions" className="hover:text-foreground">
            {copy.eyebrow}
          </Link>
          <span aria-hidden>/</span>
          <span className="text-foreground">{solution.eyebrow}</span>
        </nav>
        <SectionHeading
          as="h1"
          size="display"
          eyebrow={solution.eyebrow}
          title={solution.title}
          subtitle={solution.lead}
        />
      </PageContainer>
      <PageContainer as="section" className="pb-16">
        <ul className="grid gap-6 md:grid-cols-2">
          {solution.points.map((point) => (
            <li key={point.title} className="surface-card flex flex-col gap-2 rounded-3xl p-7">
              <h2 className="text-lg font-semibold text-foreground">{point.title}</h2>
              <p className="text-sm text-pretty text-muted-foreground">{point.body}</p>
            </li>
          ))}
        </ul>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href={solution.guide.href}
            className={buttonVariants({ variant: 'outline', size: 'lg' })}
          >
            <ArrowRight aria-hidden />
            {`${copy.readGuide}: ${solution.guide.label}`}
          </a>
          {solution.sample ? (
            <a
              href={solution.sample.href}
              download
              className={buttonVariants({ variant: 'outline', size: 'lg' })}
            >
              <Download aria-hidden />
              {solution.sample.label}
            </a>
          ) : null}
        </div>
      </PageContainer>
      <PageContainer as="section" className="flex flex-col items-center gap-10 py-16">
        <SectionHeading title={copy.faqTitle} size="subsection" />
        <FaqList items={solution.faq} className="max-w-[50rem] border-t border-border" />
      </PageContainer>
      <PageContainer as="section" className="py-12">
        <h2 className="mb-6 text-2xl font-semibold text-foreground">{copy.related}</h2>
        <ul className="grid gap-4 md:grid-cols-3">
          {related.map((r) => (
            <li key={r.slug}>
              <Link
                href={`/solutions/${r.slug}`}
                className="surface-card flex h-full flex-col gap-1 rounded-2xl p-5 transition-colors hover:border-border-strong"
              >
                <span className="text-xs text-muted-foreground">{r.eyebrow}</span>
                <span className="font-semibold text-foreground">{r.metaTitle}</span>
              </Link>
            </li>
          ))}
        </ul>
      </PageContainer>
      <CtaBand title={copy.cta.title} body={copy.cta.body} inline />
    </SiteShell>
  )
}
