import type { Metadata } from 'next'
import { ARTICLE_TABS, blogListContent } from '@/data/blog'
import { appRouter, call, serverContext } from '@/lib/api'
import { LIST_PER_PAGE, parseListQuery, type SearchParams } from '@/lib/list-query'
import BlogPostsPage from './blog-posts-page'

export const metadata: Metadata = { title: blogListContent.heading }

type Props = { searchParams: Promise<SearchParams> }

export default async function Page({ searchParams }: Props) {
  const query = parseListQuery(await searchParams, ARTICLE_TABS)
  const context = await serverContext()
  const [blogs, result, counts, tags] = await Promise.all([
    call(appRouter.blog.blogs, undefined, { context }),
    call(
      appRouter.blog.list,
      {
        page: query.page,
        perPage: LIST_PER_PAGE,
        query: query.query || undefined,
        status: query.status ?? 'all',
      },
      { context },
    ),
    call(appRouter.blog.counts, undefined, { context }),
    call(appRouter.blog.tags, undefined, { context }),
  ])

  return <BlogPostsPage initial={{ query, result, counts, blogs, tags }} />
}
