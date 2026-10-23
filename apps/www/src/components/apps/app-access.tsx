import type { CatalogueApp } from '@commerce/core/app-catalogue'
import { appsContent as copy, levelLabel, resourceLabel } from '@/data/apps'

type AppAccessProps = { app: CatalogueApp }

/**
 * The permissions the app asks for, the same list the admin's Permissions step shows before
 * install: each store area, read or write, and why. Then what leaves the store, if anything.
 */
export default function AppAccess({ app }: AppAccessProps) {
  return (
    <section className="surface-card flex flex-col gap-5 rounded-2xl p-5 md:p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-foreground">{copy.access}</h2>
        <p className="text-sm text-muted-foreground">{copy.accessIntro}</p>
      </div>
      <ul className="flex flex-col divide-y divide-border">
        {app.access.resources.map((r) => (
          <li
            key={r.resource}
            className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:gap-4"
          >
            <span className="flex shrink-0 items-baseline gap-2 sm:w-52">
              <span className="text-sm font-medium text-foreground">
                {resourceLabel(r.resource)}
              </span>
              <span className="text-xs text-muted-foreground">{levelLabel(r.level)}</span>
            </span>
            <span className="text-sm text-muted-foreground">{r.why}</span>
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <h3 className="text-sm font-semibold text-foreground">{copy.shares}</h3>
        {app.access.shares.length === 0 ? (
          <p className="text-sm text-muted-foreground">{copy.sharesNothing}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {app.access.shares.map((s) => (
              <li key={`${s.when}-${s.what}`} className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{s.when}:</span> {s.what}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
