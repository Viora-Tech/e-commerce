import {
  Boxes,
  Download,
  FileText_ as FileText,
  Globe,
  Lock,
  ShieldCheck_ as ShieldCheck,
  UserCog,
} from '@commerce/ui/icons'
import { buttonVariants } from '@commerce/ui/shadcn/button'
import type { ComponentType } from 'react'
import PageContainer from '@/components/common/page-container'
import Reveal from '@/components/common/reveal'
import SectionHeading from '@/components/common/section-heading'
import SiteShell from '@/components/layout/site-shell'
import SecurityDiagram from '@/components/pages/security-diagram'
import { securityContent as copy } from '@/data/security'
import { pageMetadata } from '@/lib/metadata'

export const metadata = pageMetadata({
  title: 'Security',
  description:
    'How a request is protected: hosted in India, every store kept apart, encrypted secrets and backups, roles and permissions.',
  path: '/security',
})

const PILLAR_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  india: Globe,
  isolation: ShieldCheck,
  secrets: Lock,
  backups: Download,
  roles: UserCog,
  data: FileText,
}

export default function SecurityPage() {
  return (
    <SiteShell>
      <PageContainer
        as="section"
        className="flex flex-col items-center gap-10 pt-20 pb-16 md:pt-28"
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <p className="text-eyebrow">{copy.eyebrow}</p>
          <h1 className="text-6xl font-semibold text-balance text-foreground md:text-8xl md:tracking-tighter">
            {copy.title[0]}
            <br />
            {copy.title[1]}
          </h1>
          <p className="max-w-2xl text-lead text-pretty text-muted-foreground">{copy.subtitle}</p>
        </div>
        <div className="w-full">
          <SecurityDiagram />
        </div>
      </PageContainer>
      <PageContainer as="section" className="flex flex-col items-center gap-12 py-16 md:py-24">
        <SectionHeading eyebrow={copy.pillars.eyebrow} title={copy.pillars.title} />
        <ul className="grid w-full gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          {copy.pillars.items.map((item, index) => {
            const Icon = PILLAR_ICONS[item.key] ?? Boxes
            return (
              <Reveal
                as="li"
                step={index % 3}
                key={item.key}
                className="surface-card card-lift flex flex-col gap-3 rounded-3xl p-6"
              >
                <span className="mb-3 grid size-10 place-items-center rounded-xl border border-border bg-muted">
                  <Icon aria-hidden className="size-5" />
                </span>
                <h3 className="text-lg font-semibold text-foreground">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.body}</p>
              </Reveal>
            )
          })}
        </ul>
      </PageContainer>
      <PageContainer as="section" className="pb-24">
        <div className="glass-panel flex flex-col gap-5 rounded-3xl p-7 md:flex-row md:items-center md:justify-between md:p-8">
          <div>
            <h2 className="text-xl font-semibold text-foreground">{copy.report.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{copy.report.body}</p>
          </div>
          <a href={copy.report.href} className={buttonVariants({ variant: 'outline', size: 'lg' })}>
            {copy.report.cta}
          </a>
        </div>
      </PageContainer>
    </SiteShell>
  )
}
