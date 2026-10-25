import type { CatalogueAccessLevel, CatalogueApp } from '@commerce/core/app-catalogue'
import { Eye_ as Eye, Pencil } from '@commerce/ui/icons'
import { accessSentence, appsContent as copy } from '@/data/apps'

type AppAccessProps = { app: CatalogueApp }

/** Seeing is an eye; anything that adds or changes is a pencil, so the riskier rows stand out. */
const ICONS: Record<CatalogueAccessLevel, typeof Eye> = {
  read: Eye,
  write: Pencil,
  'read-write': Pencil,
}

/**
 * The permissions the app asks for, the same list the admin's Permissions step shows before
 * install, in plain words ("Can see orders") with the app’s own reason under each. What leaves
 * the store is drawn in the showcase (`app-data-flow`).
 */
export default function AppAccess({ app }: AppAccessProps) {
  return (
    <section aria-labelledby="access-title" className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h2 id="access-title" className="text-2xl font-semibold tracking-tight text-foreground">
          {copy.access}
        </h2>
        <p className="text-sm text-pretty text-muted-foreground">{copy.accessIntro}</p>
      </div>
      <ul className="flex flex-col overflow-hidden rounded-[1.25rem] ring-1 ring-border ring-inset">
        {app.access.resources.map((r) => {
          const Icon = ICONS[r.level]
          return (
            <li
              key={r.resource}
              className="flex gap-4 border-b border-border px-4 py-4 last:border-b-0 md:px-5"
            >
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-foreground/5 ring-1 ring-border ring-inset">
                <Icon aria-hidden className="size-4 text-foreground" />
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sm font-medium text-foreground">
                  {accessSentence(r.resource, r.level)}
                </span>
                <span className="text-sm text-pretty text-muted-foreground">{r.why}</span>
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
