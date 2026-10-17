import { siteConfig, whatsappHelpUrl } from '@commerce/config/site'
import {
  ArrowRight_ as ArrowRight,
  Clock,
  Inbox,
  WhatsappLogo_ as WhatsappLogo,
} from '@commerce/ui/icons'
import PageContainer from '@/components/common/page-container'
import SectionHeading from '@/components/common/section-heading'
import SiteShell from '@/components/layout/site-shell'
import ContactForm from '@/components/pages/contact-form'
import { contactContent as copy } from '@/data/contact'
import { pageMetadata } from '@/lib/metadata'

export const metadata = pageMetadata({
  title: 'Contact',
  description:
    'Talk to a human: WhatsApp, email or a 20-minute call about moving your store or picking a plan.',
  path: '/contact',
})

const ICONS = { whatsapp: WhatsappLogo, email: Inbox, call: Clock }

// PLACEHOLDER: the booking link is not decided yet; the card points at email until it is.
const HREFS = {
  whatsapp: whatsappHelpUrl(),
  email: `mailto:${siteConfig.contact.supportEmail}`,
  call: `mailto:${siteConfig.contact.supportEmail}`,
}

export default function ContactPage() {
  return (
    <SiteShell>
      <PageContainer as="section" className="flex flex-col items-center gap-6 pt-20 pb-12 md:pt-28">
        <p className="glass-popover inline-flex h-7 items-center gap-2 rounded-full px-3 text-xs text-foreground">
          <span aria-hidden className="size-1.5 rounded-full bg-success" />
          {copy.status}
        </p>
        <SectionHeading as="h1" size="display" title={copy.title} subtitle={copy.subtitle} />
      </PageContainer>
      <PageContainer as="section" className="pb-12">
        <ul className="grid gap-4 md:grid-cols-3">
          {copy.channels.map((channel) => {
            const Icon = ICONS[channel.key as keyof typeof ICONS]
            return (
              <li
                key={channel.key}
                className="surface-card card-lift flex flex-col gap-3 rounded-3xl p-6"
              >
                <span className="grid size-10 place-items-center rounded-xl border border-border bg-muted">
                  <Icon aria-hidden className="size-5" />
                </span>
                <h2 className="text-lg font-semibold text-foreground">{channel.title}</h2>
                <p className="text-sm text-muted-foreground">{channel.body}</p>
                <a
                  href={HREFS[channel.key as keyof typeof HREFS]}
                  className="mt-auto pt-2 text-sm font-semibold text-foreground underline-offset-4 hover:underline"
                >
                  {channel.cta}
                </a>
              </li>
            )
          })}
        </ul>
      </PageContainer>
      <PageContainer as="section" className="pb-16">
        <ContactForm />
      </PageContainer>
      <PageContainer as="section" className="flex flex-col items-center gap-8 pb-24">
        <SectionHeading eyebrow={copy.quick.eyebrow} title={copy.quick.title} size="subsection" />
        <ul className="grid w-full max-w-5xl gap-3 sm:grid-cols-2">
          {copy.quick.links.map((link) => (
            <li key={link.label}>
              <a
                href={link.href}
                className="surface-card card-lift flex items-center justify-between gap-4 rounded-xl px-5 py-4 text-sm font-medium text-foreground"
              >
                {link.label}
                <ArrowRight aria-hidden className="size-4 text-muted-foreground" />
              </a>
            </li>
          ))}
        </ul>
      </PageContainer>
    </SiteShell>
  )
}
