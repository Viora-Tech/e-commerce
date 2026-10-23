'use client'

import Link from 'next/link'
import { mediaContent } from '@/data/media'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'

type MediaFileUsedInProps = {
  rows: { productId: string; title: string }[]
}

/** The file page's Used in card body: the products whose gallery holds the file, each a link. */
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
        <li key={row.productId} className="border-b border-line last:border-0">
          <Link
            href={routes.products.detail(row.productId)}
            className="block truncate px-3 py-2 text-body text-foreground transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {row.title}
          </Link>
        </li>
      ))}
    </ul>
  )
}
