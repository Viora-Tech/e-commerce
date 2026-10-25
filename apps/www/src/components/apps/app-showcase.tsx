import type { CatalogueApp } from '@commerce/core/app-catalogue'
import { cn } from '@commerce/ui/lib/utils'
import { appsContent as copy } from '@/data/apps'
import AppAdminMock from './app-admin-mock'
import AppDataFlow from './app-data-flow'
import AppThemeMock from './app-theme-mock'

type AppShowcaseProps = { app: CatalogueApp }

/**
 * The app page's picture: real screenshots when the listing has them; otherwise (and beside
 * them) a drawing made from the listing itself: the app in the admin, what crosses to its
 * company, and the theme block it adds. All inside one machined tray.
 */
export default function AppShowcase({ app }: AppShowcaseProps) {
  // Render logic
  const hasTheme = app.themeBlocks.length > 0

  return (
    <section
      aria-label={copy.showcase}
      className="rounded-[2rem] bg-foreground/[0.025] p-1.5 ring-1 ring-border"
    >
      <div className="surface-card flex flex-col gap-4 rounded-[calc(2rem-0.375rem)] p-3 md:p-4">
        {app.screenshots.length > 0 ? (
          <ul className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto">
            {app.screenshots.map((shot) => (
              <li key={shot.src} className="w-[88%] shrink-0 snap-start md:w-[60%]">
                {/* biome-ignore lint/performance/noImgElement: static export, images ship as they are */}
                <img
                  src={shot.src}
                  alt={shot.alt}
                  loading="lazy"
                  decoding="async"
                  className="aspect-video w-full rounded-[1.5rem] object-cover ring-1 ring-border"
                />
              </li>
            ))}
          </ul>
        ) : null}
        <div className="grid gap-3 md:gap-4 lg:grid-cols-12">
          <AppAdminMock app={app} className="lg:col-span-7" />
          <div
            className={cn(
              'grid gap-3 md:gap-4 lg:col-span-5',
              hasTheme && 'md:grid-cols-2 lg:grid-cols-1',
            )}
          >
            <AppDataFlow app={app} />
            {hasTheme ? <AppThemeMock blocks={app.themeBlocks} /> : null}
          </div>
        </div>
      </div>
    </section>
  )
}
