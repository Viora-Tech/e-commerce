import type { CatalogueApp } from '@commerce/core/app-catalogue'
import { CheckIcon } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import Link from 'next/link'
import {
  categoryCopy,
  categoryPath,
  appsContent as copy,
  maker,
  priceChip,
  priceRows,
  priceText,
} from '@/data/apps'

type AppFactsProps = { app: CatalogueApp; className?: string }

const LINK =
  'font-medium text-foreground underline decoration-border underline-offset-4 outline-none hover:decoration-foreground focus-visible:ring-3 focus-visible:ring-ring/60'

/** "Works with": the outside account a connection needs first, then the manifest's notes. */
function worksWith(app: CatalogueApp): string[] {
  return [
    ...(app.kind === 'connection' && app.company ? [copy.needsAccount(app.company)] : []),
    ...app.worksWith,
  ]
}

/**
 * The app page's side column: the pricing card (the price, then what it costs on each plan),
 * what it works with, and the details (maker, category, the open source it is built on).
 */
export default function AppFacts({ app, className }: AppFactsProps) {
  // Render logic
  const pairs = worksWith(app)
  const rows = [
    { label: copy.developer, value: maker(app) },
    {
      label: copy.category,
      value: (
        <Link href={categoryPath(app.category)} className={LINK}>
          {categoryCopy(app.category).label}
        </Link>
      ),
    },
    ...(app.credits.length > 0
      ? [
          {
            label: copy.builtOn,
            value: app.credits.map((c, i) => (
              <span key={c.name}>
                {i > 0 ? ', ' : null}
                <a href={c.url} className={LINK} rel="noopener">
                  {c.name}
                </a>{' '}
                <span className="text-muted-foreground">({c.license})</span>
              </span>
            )),
          },
        ]
      : []),
  ]

  return (
    <aside className={cn('flex flex-col gap-4', className)}>
      <section
        aria-labelledby="pricing-title"
        className="rounded-[1.75rem] bg-foreground/[0.025] p-1.5 ring-1 ring-border"
      >
        <div className="surface-card flex flex-col gap-5 rounded-[calc(1.75rem-0.375rem)] p-5">
          <div className="flex flex-col gap-1">
            <h2 id="pricing-title" className="text-sm font-medium text-muted-foreground">
              {copy.priceTitle}
            </h2>
            <p className="text-3xl font-semibold tracking-tight text-foreground tabular-nums">
              {priceChip(app.price)}
            </p>
            <p className="text-sm text-pretty text-muted-foreground">{priceText(app.price)}</p>
          </div>
          {app.price.kind === 'paid' ? (
            <dl className="flex flex-col border-t border-border">
              {priceRows(app.price).map((row) => (
                <div
                  key={row.plan}
                  className="flex items-center justify-between gap-3 border-b border-border py-2.5 last:border-b-0 last:pb-0"
                >
                  <dt className="text-sm text-muted-foreground">{row.plan}</dt>
                  <dd className="m-0 text-sm font-medium text-foreground tabular-nums">
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      </section>

      {pairs.length > 0 ? (
        <section className="flex flex-col gap-3 rounded-[1.5rem] p-5 ring-1 ring-border ring-inset">
          <h2 className="text-sm font-semibold text-foreground">{copy.worksWith}</h2>
          <ul className="flex flex-col gap-2.5">
            {pairs.map((item) => (
              <li key={item} className="flex gap-2.5 text-sm text-pretty text-muted-foreground">
                <CheckIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-foreground" />
                {item}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="flex flex-col gap-3 rounded-[1.5rem] p-5 ring-1 ring-border ring-inset">
        <h2 className="text-sm font-semibold text-foreground">{copy.details}</h2>
        <dl className="flex flex-col gap-3">
          {rows.map((row) => (
            <div key={row.label} className="flex items-baseline justify-between gap-4">
              <dt className="shrink-0 text-sm text-muted-foreground">{row.label}</dt>
              <dd className="m-0 text-right text-sm text-foreground">{row.value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </aside>
  )
}
