import { cn } from '@commerce/ui/lib/utils'
import Link from 'next/link'
import CtaBand from '@/components/common/cta-band'
import JsonLd from '@/components/common/json-ld'
import PageContainer from '@/components/common/page-container'
import SectionHeading from '@/components/common/section-heading'
import SiteShell from '@/components/layout/site-shell'
import { solutionsContent as copy, SOLUTIONS } from '@/data/solutions'
import { pageMetadata } from '@/lib/metadata'
import { breadcrumbLd } from '@/lib/seo'

export const metadata = pageMetadata({
  title: 'E-commerce solutions for Indian brands',
  description: copy.metaDescription,
  path: '/solutions',
})

/**
 * Spans that keep every row of the grid full, whatever the number of solutions: on two columns the
 * first card goes wide when the count is odd; on three, the first goes wide when one cell would be
 * left over, and the last too when two would.
 */
function cardSpan(index: number, count: number) {
  const last = index === count - 1
  const lgWide = (index === 0 && count % 3 !== 0) || (last && index !== 0 && count % 3 === 1)
  return cn(
    index === 0 && count % 2 === 1 && 'md:col-span-2',
    lgWide ? 'lg:col-span-2' : 'lg:col-span-1',
  )
}

export default function SolutionsPage() {
  return (
    <SiteShell>
      <JsonLd data={breadcrumbLd([{ name: copy.eyebrow, path: '/solutions' }])} />
      <PageContainer as="section" className="pt-20 pb-12 md:pt-28 md:pb-16">
        <SectionHeading
          as="h1"
          size="display"
          eyebrow={copy.eyebrow}
          title={copy.title}
          subtitle={copy.subtitle}
        />
      </PageContainer>
      <PageContainer as="section" className="pb-16">
        <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {SOLUTIONS.map((s, index) => (
            <li key={s.slug} className={cardSpan(index, SOLUTIONS.length)}>
              <Link
                href={`/solutions/${s.slug}`}
                className="surface-card flex h-full flex-col gap-2 rounded-3xl p-7 transition-colors hover:border-border-strong"
              >
                <span className="text-xs text-muted-foreground">{s.eyebrow}</span>
                <h2 className="text-lg font-semibold text-foreground">{s.metaTitle}</h2>
                <p className="text-sm text-pretty text-muted-foreground">{s.description}</p>
              </Link>
            </li>
          ))}
        </ul>
      </PageContainer>
      <CtaBand title={copy.cta.title} body={copy.cta.body} inline />
    </SiteShell>
  )
}
