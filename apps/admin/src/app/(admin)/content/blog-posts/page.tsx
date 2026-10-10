import { siteConfig } from '@commerce/config/site'
import type { Metadata } from 'next'
import { ARTICLE_TABS, blogListContent } from '@/data/blog'
import { appRouter, call, serverContext } from '@/lib/api'
import { parseListQuery, type SearchParams } from '@/lib/list-query'
import BlogPostsPage from './blog-posts-page'

export const metadata: Metadata = { title: blogListContent.heading }

type Props = { searchParams: Promise<SearchParams> }

/** The rows-per-page choice in the address, or the store default. */
function parsePerPage(sp: SearchParams): number {
  const raw = Number.parseInt(String(Array.isArray(sp.perPage) ? sp.perPage[0] : sp.perPage), 10)
  const options: readonly number[] = siteConfig.ui.rowsPerPage.options
  return options.includes(raw) ? raw : siteConfig.ui.rowsPerPage.default
}

export default async function Page({ searchParams }: Props) {
  const sp = await searchParams
  const query = parseListQuery(sp, ARTICLE_TABS)
  const perPage = parsePerPage(sp)
  const context = await serverContext()
  const [blogs, result, counts, tags] = await Promise.all([
    call(appRouter.blog.blogs, undefined, { context }),
    call(
      appRouter.blog.list,
      {
        page: query.page,
        perPage,
        query: query.query || undefined,
        status: query.status ?? 'all',
      },
      { context },
    ),
    call(appRouter.blog.counts, undefined, { context }),
    call(appRouter.blog.tags, undefined, { context }),
  ])

  return <BlogPostsPage initial={{ query, perPage, result, counts, blogs, tags }} />
}
