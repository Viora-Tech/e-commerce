import { siteConfig, whatsappHelpUrl } from '@commerce/config/site'
import { CheckIcon, WhatsappLogo_ as WhatsappLogo } from '@commerce/ui/icons'
import { buttonVariants } from '@commerce/ui/shadcn/button'
import type { Metadata } from 'next'
import Link from 'next/link'
import GlobeBackdrop from '@/components/common/globe-backdrop'
import PageContainer from '@/components/common/page-container'
import SiteShell from '@/components/layout/site-shell'
import ShareLinkField from '@/components/waitlist/share-link-field'
import { waitlistContent as copy } from '@/data/waitlist'

export const metadata: Metadata = {
  title: copy.success.title,
  robots: { index: false },
}

export default function WaitlistThanksPage() {
  return (
    <SiteShell>
      <section className="relative overflow-hidden">
        <PageContainer className="flex flex-col items-center gap-6 pt-16 text-center md:pt-24">
          <span className="grid size-14 place-items-center rounded-full bg-foreground text-background">
            <CheckIcon aria-hidden className="size-6" />
          </span>
          <h1 className="text-5xl font-semibold text-balance text-foreground md:text-display">
            {copy.success.title}
          </h1>
          <p className="max-w-xl text-lead text-pretty text-muted-foreground">
            {copy.success.body}
          </p>
          <ol className="mt-4 grid w-full max-w-4xl gap-4 text-left md:grid-cols-3">
            {copy.success.steps.map((step, index) => (
              <li key={step.title} className="surface-card flex flex-col gap-2 rounded-2xl p-5">
                <span className="font-mono text-xs text-muted-foreground">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h2 className="text-lg font-semibold text-foreground">{step.title}</h2>
                <p className="text-sm text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
          <div className="w-full max-w-md">
            <ShareLinkField />
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <a
              href={whatsappHelpUrl(
                `${copy.success.whatsappShare} https://${siteConfig.brand.domain}`,
              )}
              className={buttonVariants({ variant: 'outline', size: 'lg' })}
            >
              <WhatsappLogo aria-hidden />
              {copy.success.shareOnWhatsApp}
            </a>
            <Link href="/" className={buttonVariants({ variant: 'ghost', size: 'lg' })}>
              {copy.success.backHome}
            </Link>
          </div>
        </PageContainer>
        <GlobeBackdrop className="mt-12" />
      </section>
    </SiteShell>
  )
}
