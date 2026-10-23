import { siteConfig } from '@commerce/config/site'
import type { CatalogueApp } from '@commerce/core/app-catalogue'
import Link from 'next/link'
import { byline, categoryCopy, categoryPath, appsContent as copy, priceText } from '@/data/apps'

type AppFactsProps = { app: CatalogueApp }

const LINK = 'font-medium text-foreground underline-offset-2 hover:underline'

/** The side column of an app's page: price, maker, category, the guide and what it is built on. */
export default function AppFacts({ app }: AppFactsProps) {
  // Render logic
  const rows = [
    { label: copy.developer, value: byline(app).replace(/^by /, '') },
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
                ({c.license})
              </span>
            )),
          },
        ]
      : []),
  ]

  return (
    <aside className="flex flex-col gap-4">
      <section className="surface-card flex flex-col gap-2 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-foreground">{copy.priceTitle}</h2>
        <p className="text-sm text-muted-foreground">{priceText(app.price)}</p>
      </section>
      <section className="surface-card flex flex-col gap-3 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-foreground">{copy.details}</h2>
        <dl className="flex flex-col gap-3">
          {rows.map((row) => (
            <div key={row.label} className="flex flex-col gap-0.5">
              <dt className="text-xs text-muted-foreground">{row.label}</dt>
              <dd className="m-0 text-sm text-foreground">{row.value}</dd>
            </div>
          ))}
        </dl>
        {app.guide ? (
          <a href={`${siteConfig.urls.docs}${app.guide}`} className={`text-sm ${LINK}`}>
            {copy.guide}
          </a>
        ) : null}
      </section>
    </aside>
  )
}
