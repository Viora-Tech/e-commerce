import type { CatalogueApp } from '@commerce/core/app-catalogue'
import { ArrowRight_ as ArrowRight } from '@commerce/ui/icons'
import Link from 'next/link'
import { categoryCopy, categoryPath, appsContent as copy } from '@/data/apps'
import AppCard from './app-card'

type CategorySectionsProps = {
  apps: CatalogueApp[]
  categories: { slug: string; count: number }[]
}

/** How many apps a category shows on the front page before "See all". */
const PREVIEW = 6

/** The front page's category shelves: a heading, one line, the first few apps and "See all". */
export default function CategorySections({ apps, categories }: CategorySectionsProps) {
  return (
    <section aria-labelledby="browse-title" className="flex flex-col gap-14 md:gap-20">
      <h2 id="browse-title" className="sr-only">
        {copy.browse}
      </h2>
      {categories.map((category) => {
        const words = categoryCopy(category.slug)
        const inCategory = apps.filter((a) => a.category === category.slug).slice(0, PREVIEW)
        return (
          <section
            key={category.slug}
            aria-labelledby={`cat-${category.slug}`}
            className="flex flex-col gap-6"
          >
            <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex max-w-2xl flex-col gap-1.5">
                <h3
                  id={`cat-${category.slug}`}
                  className="flex items-baseline gap-3 text-2xl font-semibold tracking-tight text-foreground"
                >
                  {words.label}
                  <span className="text-sm font-normal text-muted-foreground tabular-nums">
                    {category.count}
                  </span>
                </h3>
                <p className="text-sm text-pretty text-muted-foreground">{words.description}</p>
              </div>
              <Link
                href={categoryPath(category.slug)}
                className="group inline-flex shrink-0 items-center gap-1.5 self-start rounded-full text-sm font-medium text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/60 sm:self-auto"
              >
                {copy.seeAll(category.count)}
                <span className="sr-only"> {words.label}</span>
                <ArrowRight
                  aria-hidden
                  className="size-4 transition-transform duration-(--duration-popover) ease-out group-hover:translate-x-0.5 motion-reduce:group-hover:translate-x-0"
                />
              </Link>
            </div>
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {inCategory.map((app) => (
                <li key={app.id}>
                  <AppCard app={app} />
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </section>
  )
}
