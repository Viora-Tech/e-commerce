import type { CatalogueApp } from '@commerce/core/app-catalogue'
import KoomerceMark from '@commerce/ui/brand'
import { ArrowLeftRight } from '@commerce/ui/icons'
import { appsContent as copy, maker } from '@/data/apps'
import AppTile from './app-tile'

type AppDataFlowProps = { app: CatalogueApp }

/**
 * Your store on one side, the app's company on the other, and exactly what crosses between
 * them, from the manifest's `shares`. Our own apps show the store alone when nothing leaves it.
 */
export default function AppDataFlow({ app }: AppDataFlowProps) {
  // Render logic
  const outside = app.kind === 'connection'
  const shares = app.access.shares

  return (
    <section className="flex flex-col gap-5 rounded-[1.5rem] bg-background p-5 ring-1 ring-border">
      <div className="flex items-center gap-3">
        <span className="flex min-w-0 flex-1 items-center gap-2.5">
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-[0.625rem] bg-foreground text-background">
            <KoomerceMark className="h-4 w-auto" />
          </span>
          <span className="truncate text-xs font-medium text-foreground">{copy.storeSide}</span>
        </span>
        {outside ? (
          <>
            <span aria-hidden className="flex flex-1 items-center gap-1 text-muted-foreground">
              <span className="h-px flex-1 border-t border-dashed border-border-strong" />
              <ArrowLeftRight className="size-4 shrink-0" />
              <span className="h-px flex-1 border-t border-dashed border-border-strong" />
            </span>
            <span className="flex min-w-0 flex-1 items-center justify-end gap-2.5">
              <span className="truncate text-right text-xs font-medium text-foreground">
                {maker(app)}
              </span>
              <AppTile id={app.id} name={app.name} icon={app.icon} size="sm" />
            </span>
          </>
        ) : null}
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-foreground">{copy.flowTitle}</h3>
        {shares.length === 0 ? (
          <p className="text-sm text-pretty text-muted-foreground">{copy.flowNothing}</p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {shares.map((s) => (
              <li key={`${s.when}-${s.what}`} className="flex flex-col gap-0.5">
                <span className="text-xs font-medium text-foreground">{s.when}</span>
                <span className="text-sm text-pretty text-muted-foreground">{s.what}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
