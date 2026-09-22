import Link from 'next/link'
import { blogContent as copy } from '@/data/blog'

type BlogPaginationProps = { path: string; tag: string | undefined; page: number; pages: number }

function pageHref(path: string, tag: string | undefined, page: number): string {
  const qs = new URLSearchParams()
  if (tag) qs.set('tag', tag)
  if (page > 1) qs.set('page', String(page))
  const s = qs.toString()
  return s ? `${path}?${s}` : path
}

/** Previous / next links under the blog listing. */
export default function BlogPagination({ path, tag, page, pages }: BlogPaginationProps) {
  // Early returns
  if (pages <= 1) return null

  // Render logic
  return (
    <nav className="flex items-center justify-center gap-4" aria-label={copy.pageOf(page, pages)}>
      {page > 1 ? (
        <Link className="btn btn--secondary btn--pill" href={pageHref(path, tag, page - 1)}>
          {copy.previous}
        </Link>
      ) : null}
      <span className="text-caption text-muted">{copy.pageOf(page, pages)}</span>
      {page < pages ? (
        <Link className="btn btn--secondary btn--pill" href={pageHref(path, tag, page + 1)}>
          {copy.next}
        </Link>
      ) : null}
    </nav>
  )
}
