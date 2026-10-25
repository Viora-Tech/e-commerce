import { buttonVariants } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { legalContent as copy } from '@/data/legal'
import type { LegalDoc } from '@/data/legal/types'
import PageContainer from '../common/page-container'
import SiteShell from '../layout/site-shell'
import LegalActions from './legal-actions'
import LegalSection from './legal-section'
import LegalToc from './legal-toc'

type LegalPageProps = { doc: LegalDoc }

/** The one layout every policy shares: header, sticky contents and a readable column. */
export default function LegalPage({ doc }: LegalPageProps) {
  return (
    <SiteShell>
      <PageContainer className="pt-16 pb-24 md:pt-24">
        <header id="top" className="flex max-w-3xl flex-col gap-5">
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-2 text-sm text-muted-foreground"
          >
            <span>{copy.breadcrumbRoot}</span>
            <span aria-hidden>/</span>
            <span className="text-foreground">{doc.title}</span>
          </nav>
          <h1 className="text-4xl font-semibold text-balance text-foreground md:text-display">
            {doc.title}
          </h1>
          <p className="text-lead text-pretty text-muted-foreground">{doc.lead}</p>
          <LegalActions readMinutes={doc.readMinutes} />
        </header>
        <div className="mt-12 flex flex-col gap-8 lg:flex-row lg:gap-16">
          <LegalToc sections={doc.sections} />
          <article className="flex min-w-0 max-w-[45rem] flex-1 flex-col gap-10">
            {doc.sections.map((section, index) => (
              <LegalSection key={section.id} section={section} number={index + 1} />
            ))}
            <aside className="surface-card flex flex-col gap-4 rounded-2xl p-6 sm:flex-row sm:items-center sm:justify-between print:hidden">
              <div>
                <p className="text-base font-semibold text-foreground">{copy.questions.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{copy.questions.body}</p>
              </div>
              <Link href="/contact" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
                {copy.questions.cta}
              </Link>
            </aside>
          </article>
        </div>
      </PageContainer>
    </SiteShell>
  )
}
