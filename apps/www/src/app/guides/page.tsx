import Link from 'next/link'
import JsonLd from '@/components/common/json-ld'
import PageContainer from '@/components/common/page-container'
import SectionHeading from '@/components/common/section-heading'
import SiteShell from '@/components/layout/site-shell'
import { guidesContent as copy, formatGuideDate, GUIDES } from '@/data/guides'
import { pageMetadata } from '@/lib/metadata'
import { breadcrumbLd } from '@/lib/seo'

const base = pageMetadata({
  title: 'Guides for Indian online sellers',
  description: copy.metaDescription,
  path: '/guides',
})

export const metadata = {
  ...base,
  alternates: { ...base.alternates, types: { 'application/rss+xml': '/guides/rss.xml' } },
}

export default function GuidesPage() {
  return (
    <SiteShell>
      <JsonLd data={breadcrumbLd([{ name: copy.eyebrow, path: '/guides' }])} />
      <PageContainer as="section" className="pt-20 pb-12 md:pt-28 md:pb-16">
        <SectionHeading
          as="h1"
          size="display"
          eyebrow={copy.eyebrow}
          title={copy.title}
          subtitle={copy.subtitle}
        />
      </PageContainer>
      <PageContainer as="section" className="pb-24">
        <ul className="mx-auto flex max-w-[50rem] flex-col gap-4">
          {GUIDES.map((g) => (
            <li key={g.slug}>
              <Link
                href={`/guides/${g.slug}`}
                className="surface-card flex flex-col gap-2 rounded-2xl p-6 transition-colors hover:border-border-strong"
              >
                <h2 className="text-lg font-semibold text-foreground">{g.title}</h2>
                <p className="text-sm text-pretty text-muted-foreground">{g.description}</p>
                <p className="text-xs text-muted-foreground">
                  {formatGuideDate(g.updated)} · {copy.minutes(g.readMinutes)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-8 text-center text-sm">
          <a href="/guides/rss.xml" className="text-muted-foreground hover:text-foreground">
            {copy.rss}
          </a>
        </p>
      </PageContainer>
    </SiteShell>
  )
}
