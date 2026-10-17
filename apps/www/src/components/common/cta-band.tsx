import { siteConfig } from '@commerce/config/site'
import { Inbox } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { buttonVariants } from '@commerce/ui/shadcn/button'
import JoinWaitlistButton from '../waitlist/join-waitlist-button'
import PageContainer from './page-container'
import Reveal from './reveal'

type CtaBandProps = {
  title: string
  body?: string
  /** Adds the "Email us" secondary action (the home page's closing card). */
  emailLabel?: string
  /** Compact left-aligned band used at the foot of inner pages. */
  inline?: boolean
}

export default function CtaBand({ title, body, emailLabel, inline = false }: CtaBandProps) {
  return (
    <PageContainer as="section" className="py-10 md:py-16">
      <Reveal
        className={cn(
          'glass-panel relative overflow-hidden rounded-[2rem] border border-foreground/80 px-6 py-12 md:px-16 md:py-20',
          inline
            ? 'flex flex-col gap-6 md:flex-row md:items-center md:justify-between md:py-12'
            : 'flex flex-col items-center gap-6 text-center',
        )}
      >
        <div className={cn('flex flex-col gap-3', inline ? 'items-start' : 'items-center')}>
          <h2
            className={cn(
              'font-semibold text-balance text-foreground',
              inline ? 'text-3xl md:text-subsection' : 'text-4xl md:text-display',
            )}
          >
            {title}
          </h2>
          {body ? <p className="text-sm text-muted-foreground">{body}</p> : null}
        </div>
        <div className={cn('flex flex-col gap-3 sm:flex-row', inline ? 'sm:shrink-0' : null)}>
          <JoinWaitlistButton size="lg" arrow />
          {emailLabel ? (
            <a
              href={`mailto:${siteConfig.contact.supportEmail}`}
              className={buttonVariants({
                variant: 'outline',
                size: 'lg',
                className: 'rounded-full',
              })}
            >
              <Inbox aria-hidden />
              {emailLabel}
            </a>
          ) : null}
        </div>
      </Reveal>
    </PageContainer>
  )
}
