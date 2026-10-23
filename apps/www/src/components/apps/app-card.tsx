import type { CatalogueApp } from '@commerce/core/app-catalogue'
import KoomerceMark from '@commerce/ui/brand'
import { cn } from '@commerce/ui/lib/utils'
import Link from 'next/link'
import { appPath, appsContent as copy, maker, priceIncluded } from '@/data/apps'
import AppTile from './app-tile'
import PriceChip from './price-chip'

type AppCardProps = {
  app: CatalogueApp
  /** `row`: a fixed width for the horizontal collection rows. */
  variant?: 'grid' | 'row'
}

/**
 * One app in the directory: its icon and price, name and maker, and one line on what it does.
 * The whole card is the link; it lifts a hair on hover and settles on press.
 */
export default function AppCard({ app, variant = 'grid' }: AppCardProps) {
  // Render logic
  const ours = app.kind === 'builtin'
  const included = priceIncluded(app.price)

  return (
    <Link
      href={appPath(app.id)}
      className={cn(
        'group surface-card card-lift relative flex h-full flex-col gap-4 rounded-[1.25rem] p-5 outline-none focus-visible:ring-3 focus-visible:ring-ring/60',
        variant === 'row' && 'w-[17.5rem] sm:w-[19rem]',
      )}
    >
      <span className="flex items-start justify-between gap-3">
        <AppTile
          id={app.id}
          name={app.name}
          icon={app.icon}
          ours={ours}
          className="transition-[scale] duration-(--duration-popover) ease-out group-hover:scale-[1.04] motion-reduce:group-hover:scale-100"
        />
        <PriceChip price={app.price} />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-base font-semibold tracking-tight text-foreground">
          {app.name}
        </span>
        <span className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
          {ours ? <KoomerceMark className="h-2.5 w-auto shrink-0 text-foreground" /> : null}
          {ours ? copy.builtBadge : `by ${maker(app)}`}
        </span>
      </span>
      <span className="line-clamp-2 text-sm text-pretty text-muted-foreground">{app.tagline}</span>
      {included ? <span className="mt-auto text-xs text-muted-foreground">{included}</span> : null}
    </Link>
  )
}
