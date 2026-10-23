import type { CatalogueApp } from '@commerce/core/app-catalogue'
import { CheckIcon } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { appsContent as copy, resourceLabel } from '@/data/apps'
import AppTile from './app-tile'

type AppAdminMockProps = { app: CatalogueApp; className?: string }

/**
 * A drawing of the app inside the admin, built only from its listing: the pages it adds down the
 * side, the first one open, its highlights as the page's rows, and the store areas it works on.
 * Not a screenshot, so it never goes stale and never pretends to show real data.
 */
export default function AppAdminMock({ app, className }: AppAdminMockProps) {
  // Render logic
  const pages = app.adminPages
  const open = pages[0] ?? app.name
  const areas = app.access.resources.slice(0, 4).map((r) => resourceLabel(r.resource))

  return (
    <figure
      className={cn(
        'flex min-w-0 flex-col overflow-hidden rounded-[1.5rem] bg-background ring-1 ring-border',
        className,
      )}
    >
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <span aria-hidden className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-foreground/15" />
          <span className="size-2.5 rounded-full bg-foreground/15" />
          <span className="size-2.5 rounded-full bg-foreground/15" />
        </span>
        <span className="min-w-0 truncate rounded-full bg-foreground/5 px-3 py-1 font-mono text-[0.6875rem] text-muted-foreground">
          admin / apps / {app.id}
        </span>
      </div>
      <div className="flex min-h-[18rem] flex-1">
        <div className="hidden w-44 shrink-0 flex-col gap-1 border-r border-border p-3 sm:flex">
          <span className="mb-2 flex items-center gap-2 px-1">
            <AppTile
              id={app.id}
              name={app.name}
              icon={app.icon}
              ours={app.kind === 'builtin'}
              size="sm"
            />
            <span className="truncate text-xs font-semibold text-foreground">{app.name}</span>
          </span>
          {pages.length > 0 ? (
            pages.map((page, i) => (
              <span
                key={page}
                className={cn(
                  'truncate rounded-lg px-2.5 py-1.5 text-xs',
                  i === 0
                    ? 'bg-foreground/10 font-medium text-foreground'
                    : 'text-muted-foreground',
                )}
              >
                {page}
              </span>
            ))
          ) : (
            <span className="px-2.5 text-xs text-pretty text-muted-foreground">
              {copy.adminNone}
            </span>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-4 p-4 md:p-5">
          <span className="text-base font-semibold tracking-tight text-foreground">{open}</span>
          <ul className="flex flex-col gap-2">
            {app.highlights.map((line) => (
              <li
                key={line}
                className="flex items-center gap-3 rounded-xl bg-foreground/[0.04] px-3 py-2.5 ring-1 ring-border ring-inset"
              >
                <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
                  <CheckIcon aria-hidden className="size-3" strokeWidth={2} />
                </span>
                <span className="min-w-0 text-sm text-pretty text-foreground">{line}</span>
              </li>
            ))}
          </ul>
          {areas.length > 0 ? (
            <span className="mt-auto flex flex-wrap gap-1.5">
              {areas.map((area) => (
                <span
                  key={area}
                  className="rounded-full px-2.5 py-1 text-[0.6875rem] text-muted-foreground ring-1 ring-border ring-inset"
                >
                  {area}
                </span>
              ))}
            </span>
          ) : null}
        </div>
      </div>
      <figcaption className="sr-only">{copy.showcase}</figcaption>
    </figure>
  )
}
