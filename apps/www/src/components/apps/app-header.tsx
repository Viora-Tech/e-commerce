import type { CatalogueApp } from '@commerce/core/app-catalogue'
import KoomerceMark from '@commerce/ui/brand'
import { ChevronRight } from '@commerce/ui/icons'
import Link from 'next/link'
import { categoryCopy, categoryPath, appsContent as copy, maker, priceIncluded } from '@/data/apps'
import PageContainer from '../common/page-container'
import AppTile from './app-tile'
import InstallActions from './install-actions'
import PriceChip from './price-chip'

type AppHeaderProps = {
  app: CatalogueApp
  /** Id of the actions block, which the sticky bar watches. */
  actionsId: string
}

const CRUMB =
  'rounded-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/60'

/** The top of an app page: breadcrumb, the big icon, name, tagline, maker and price, and Install. */
export default function AppHeader({ app, actionsId }: AppHeaderProps) {
  // Render logic
  const ours = app.kind === 'builtin'
  const category = categoryCopy(app.category)
  const included = priceIncluded(app.price)

  return (
    <PageContainer as="section" className="flex flex-col gap-10 pt-10 md:gap-12 md:pt-16">
      <nav aria-label={copy.breadcrumb}>
        <ol className="flex flex-wrap items-center gap-1.5 text-sm">
          <li>
            <Link href="/apps" className={CRUMB}>
              {copy.back}
            </Link>
          </li>
          <li aria-hidden>
            <ChevronRight className="size-3.5 text-muted-foreground" />
          </li>
          <li>
            <Link href={categoryPath(app.category)} className={CRUMB}>
              {category.label}
            </Link>
          </li>
          <li aria-hidden>
            <ChevronRight className="size-3.5 text-muted-foreground" />
          </li>
          <li aria-current="page" className="truncate text-foreground">
            {app.name}
          </li>
        </ol>
      </nav>

      <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
        <div className="flex min-w-0 flex-col gap-6 sm:flex-row sm:items-center sm:gap-7">
          <AppTile id={app.id} name={app.name} icon={app.icon} ours={ours} size="xl" />
          <div className="flex min-w-0 flex-col gap-3">
            <h1 className="text-4xl font-semibold tracking-[-0.04em] text-balance text-foreground md:text-display">
              {app.name}
            </h1>
            <p className="max-w-2xl text-lead text-pretty text-muted-foreground">{app.tagline}</p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              <span className="inline-flex items-center gap-1.5 text-foreground">
                {ours ? <KoomerceMark className="h-3 w-auto" /> : null}
                {ours ? copy.builtBadge : `by ${maker(app)}`}
              </span>
              <Link href={categoryPath(app.category)} className={CRUMB}>
                {category.label}
              </Link>
              <span className="inline-flex items-center gap-2">
                <PriceChip price={app.price} />
                {included ? <span className="text-muted-foreground">{included}</span> : null}
              </span>
            </div>
          </div>
        </div>

        <div id={actionsId} className="flex shrink-0 flex-col gap-3 lg:items-end">
          <InstallActions id={app.id} guide={app.guide} />
          <p className="max-w-xs text-xs text-pretty text-muted-foreground lg:text-right">
            {copy.installHint}{' '}
            <Link
              href="/waitlist"
              className="font-medium text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
            >
              {copy.noStore} {copy.joinWaitlist}
            </Link>
          </p>
        </div>
      </div>
    </PageContainer>
  )
}
