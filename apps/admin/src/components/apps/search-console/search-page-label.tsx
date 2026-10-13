'use client'

import type { SearchItem } from '@commerce/core'
import { ExternalLink } from '@commerce/ui/icons'
import Link from 'next/link'
import { searchConsoleContent } from '@/data/search-console'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'

type SearchPageLabelProps = {
  /** The path Google's URLs were matched by, e.g. `/products/blue-kurta`. */
  path: string
  /** The URL Google showed most for it. */
  url: string
  item: SearchItem | null
  /** A line under the path, e.g. the page's top search. */
  note?: string | undefined
}

/** Where the merchant edits the item behind a page; the SEO tab for a product. */
export function itemHref(item: SearchItem): string {
  if (item.resource === 'product') return `${routes.products.detail(item.id)}?tab=seo`
  if (item.resource === 'collection') return routes.products.collection(item.id)
  return routes.onlineStore.page(item.id)
}

/** A page in the app's tables: our product, collection or page by name, its path, and Google's URL. */
export default function SearchPageLabel({ path, url, item, note }: SearchPageLabelProps) {
  // Hooks
  const copy = useCopy(searchConsoleContent)

  // Render logic
  return (
    <>
      {item ? (
        <span className="flex min-w-0 max-w-full items-baseline gap-2">
          <Link
            href={itemHref(item)}
            className="truncate font-medium text-foreground underline-offset-4 hover:underline"
          >
            {item.title}
          </Link>
          <span className="shrink-0 text-caption text-muted-foreground">
            {copy.resources[item.resource]}
          </span>
        </span>
      ) : null}
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        title={copy.open}
        className="inline-flex min-w-0 max-w-full items-center gap-1 text-caption text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        <span className="truncate">{path}</span>
        <ExternalLink className="size-3 shrink-0" aria-hidden="true" />
      </a>
      {note ? <span className="truncate text-caption text-muted-foreground">{note}</span> : null}
    </>
  )
}
