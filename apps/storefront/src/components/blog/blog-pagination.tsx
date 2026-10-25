import { Pagination } from '@commerce/blocks'

type BlogPaginationProps = { path: string; tag: string | undefined; page: number; pages: number }

function pageHref(path: string, tag: string | undefined, page: number): string {
  const qs = new URLSearchParams()
  if (tag) qs.set('tag', tag)
  if (page > 1) qs.set('page', String(page))
  const s = qs.toString()
  return s ? `${path}?${s}` : path
}

/** The blog listing's numbered pages (Figma Store / Pagination), the tag kept in each link. */
export default function BlogPagination({ path, tag, page, pages }: BlogPaginationProps) {
  return <Pagination page={page} pages={pages} hrefFor={(n) => pageHref(path, tag, n)} />
}
