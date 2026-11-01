'use client'

import type { MediaReference } from '@commerce/core'
import Link from 'next/link'
import { mediaContent } from '@/data/media'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'

type MediaFileUsedInProps = {
  rows: MediaReference[]
}

/** The admin page of one thing using the file. */
function hrefOf(row: MediaReference): string {
  switch (row.kind) {
    case 'product':
      return routes.products.detail(row.id)
    case 'collection':
      return routes.products.collection(row.id)
    case 'article':
      return routes.content.blogPost(row.id)
    case 'page':
      return routes.onlineStore.page(row.id)
    case 'review':
      return routes.apps.page('reviews')
    case 'theme':
      return routes.onlineStore.themeEditor(row.id)
  }
}

/** The file page's Used in card body: every product, collection, post, page, review and theme using the file, each a link. */
export default function MediaFileUsedIn({ rows }: MediaFileUsedInProps) {
  // Hooks
  const { details: copy } = useCopy(mediaContent)

  // Early returns
  if (rows.length === 0) {
    return <p className="text-caption text-muted-foreground">{copy.usedInEmpty}</p>
  }

  return (
    <ul className="flex flex-col rounded-lg border border-line">
      {rows.map((row) => (
        <li key={`${row.kind}-${row.id}`} className="border-b border-line last:border-0">
          <Link
            href={hrefOf(row)}
            className="flex items-center gap-2 px-3 py-2 text-body text-foreground transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="min-w-0 flex-1 truncate">{row.title}</span>
            <span className="shrink-0 text-caption text-muted-foreground">
              {copy.usedKinds[row.kind] ?? row.kind}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
