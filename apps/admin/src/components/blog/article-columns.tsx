import { displayStatus } from '@commerce/core/blog'
import type { ReactNode } from 'react'
import RelativeTime from '@/components/layout/relative-time'
import ProductThumb from '@/components/products/product-thumb'
import StatusLabel from '@/components/status/status-label'
import type { ResourceColumnSpec } from '@/components/table/resource-table'
import { blogListContent as copy } from '@/data/blog'
import type { api } from '@/lib/api-client'

export type ArticleRow = Awaited<ReturnType<typeof api.blog.list>>['rows'][number]

function publishedCell(row: ArticleRow): ReactNode {
  if (!row.publishedAt || row.status === 'draft') return copy.none
  return <RelativeTime value={row.publishedAt} />
}

/** Columns of the blog post list, in Shopify's order. */
export const articleColumns: ResourceColumnSpec<ArticleRow>[] = [
  {
    id: 'title',
    title: copy.columns.title,
    sortValue: (a) => a.title,
    hideable: false,
    align: 'start',
    className: 'w-96 px-3 whitespace-normal',
    render: (a) => (
      <span className="flex items-center gap-3 text-left">
        <ProductThumb url={a.imageUrl} />
        <span className="line-clamp-2 text-body-strong">{a.title}</span>
      </span>
    ),
  },
  {
    id: 'blog',
    title: copy.columns.blog,
    sortValue: (a) => a.blogTitle,
    render: (a) => a.blogTitle,
  },
  {
    id: 'status',
    title: copy.columns.status,
    sortValue: (a) => displayStatus(a.status, a.publishedAt),
    render: (a) => <StatusLabel kind="article" value={displayStatus(a.status, a.publishedAt)} />,
  },
  {
    id: 'author',
    title: copy.columns.author,
    sortValue: (a) => a.author,
    render: (a) => a.author || copy.none,
  },
  {
    id: 'published',
    title: copy.columns.published,
    sortValue: (a) => (a.publishedAt ? new Date(a.publishedAt) : null),
    render: (a) => <span className="tabular-nums">{publishedCell(a)}</span>,
  },
]
