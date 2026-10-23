import type { CatalogueApp } from '@commerce/core/app-catalogue'
import Link from 'next/link'
import { appCollections, appPath, priceChip } from '@/data/apps'
import AppTile from './app-tile'

type EssentialsStackProps = { apps: CatalogueApp[] }

const ROW_LINK =
  'group flex min-w-0 items-center gap-3 rounded-xl p-2 -mx-2 outline-none transition-[background-color] duration-(--duration-popover) ease-out hover:bg-foreground/5 focus-visible:ring-3 focus-visible:ring-ring/60'

/**
 * "Essentials for Indian D2C": the apps an order passes through, as the four steps it takes
 * (paid, billed, shipped, told). The steps are a real sequence, so they are numbered.
 */
export default function EssentialsStack({ apps }: EssentialsStackProps) {
  // Render logic
  const words = appCollections.essentials
  const byId = new Map(apps.map((a) => [a.id, a]))
  const steps = words.steps
    .map((step) => ({
      ...step,
      apps: step.ids.flatMap((id) => {
        const app = byId.get(id)
        return app ? [app] : []
      }),
    }))
    .filter((step) => step.apps.length > 0)

  return (
    <section
      aria-labelledby="essentials-title"
      className="rounded-[2rem] bg-foreground/[0.025] p-1.5 ring-1 ring-border"
    >
      <div className="surface-card flex flex-col gap-8 rounded-[calc(2rem-0.375rem)] p-6 md:p-10">
        <div className="flex max-w-xl flex-col gap-2">
          <h2
            id="essentials-title"
            className="text-2xl font-semibold tracking-tight text-balance text-foreground md:text-3xl"
          >
            {words.title}
          </h2>
          <p className="text-base text-pretty text-muted-foreground">{words.body}</p>
        </div>
        <ol className="relative grid gap-8 md:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          <span
            aria-hidden
            className="absolute top-3.5 right-0 left-3.5 hidden h-px bg-linear-to-r from-border via-border to-transparent lg:block"
          />
          {steps.map((step, i) => (
            <li key={step.label} className="relative flex min-w-0 flex-col gap-4">
              <span className="flex items-center gap-3">
                <span className="relative z-10 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-background text-xs font-semibold text-foreground tabular-nums ring-1 ring-border-strong">
                  {i + 1}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm font-semibold text-foreground">{step.label}</span>
                  <span className="text-xs text-muted-foreground">{step.body}</span>
                </span>
              </span>
              <ul className="flex flex-col gap-1">
                {step.apps.map((app) => (
                  <li key={app.id}>
                    <Link href={appPath(app.id)} className={ROW_LINK}>
                      <AppTile
                        id={app.id}
                        name={app.name}
                        icon={app.icon}
                        ours={app.kind === 'builtin'}
                        size="sm"
                      />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                        {app.name}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {priceChip(app.price)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
