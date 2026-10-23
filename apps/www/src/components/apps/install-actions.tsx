import { siteConfig } from '@commerce/config/site'
import { ArrowRight_ as ArrowRight, ExternalLink } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { appsContent as copy, installUrl } from '@/data/apps'
import { ctaClass } from '@/lib/cta'

type InstallActionsProps = {
  id: string
  guide: string | null
  size?: 'md' | 'lg'
  /** Hide "View docs" (the compact sticky bar keeps only Install). */
  docs?: boolean
  className?: string
}

const SECONDARY = {
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-5 text-base',
}

/**
 * Install (the orange primary, its arrow in its own circle that nudges on hover) and View docs.
 * Install opens the admin's install flow; docs open the app's merchant guide.
 */
export default function InstallActions({
  id,
  guide,
  size = 'lg',
  docs = true,
  className,
}: InstallActionsProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-3', className)}>
      <a
        href={installUrl(id)}
        className={ctaClass(
          'lg',
          cn('group gap-3 pr-1.5', size === 'lg' ? 'h-12 pl-6' : 'h-10 pl-5 text-sm'),
        )}
      >
        {copy.install}
        <span
          aria-hidden
          className={cn(
            'inline-flex items-center justify-center rounded-full bg-cta-foreground/20 transition-transform duration-(--duration-popover) ease-out group-hover:translate-x-0.5 motion-reduce:group-hover:translate-x-0',
            size === 'lg' ? 'size-9' : 'size-7',
          )}
        >
          <ArrowRight className="size-4" />
        </span>
      </a>
      {docs && guide ? (
        <a
          href={`${siteConfig.urls.docs}${guide}`}
          className={cn(
            'inline-flex items-center gap-2 rounded-full font-medium text-foreground ring-1 ring-border-strong ring-inset outline-none transition-[background-color,scale] duration-(--duration-press) ease-out hover:bg-foreground/5 focus-visible:ring-3 focus-visible:ring-ring/60 active:scale-(--motion-press-scale)',
            SECONDARY[size],
          )}
        >
          {copy.viewDocs}
          <ExternalLink aria-hidden className="size-4 text-muted-foreground" />
        </a>
      ) : null}
    </div>
  )
}
