import { displayStatus } from '@commerce/core/blog'
import OrderChip from '@/components/orders/order-chip'
import ProductThumb from '@/components/products/product-thumb'
import type { ResourceColumnSpec } from '@/components/table/resource-table'
import type { blogListContent } from '@/data/blog'
import type { api } from '@/lib/api-client'
import type { Formatters } from '@/lib/format'

export type ArticleRow = Awaited<ReturnType<typeof api.blog.list>>['rows'][number]

/** Columns of the blog post list: post with its author, blog, centred status, last change. */
export function articleColumns(
  copy: typeof blogListContent,
  fmt: Formatters,
): ResourceColumnSpec<ArticleRow>[] {
  return [
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
          <span className="flex min-w-0 flex-col">
            <span className="line-clamp-1 text-ink-strong">{a.title}</span>
            {a.excerpt ? (
              <span className="line-clamp-1 text-caption text-muted-foreground">{a.excerpt}</span>
            ) : null}
          </span>
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
      render: (a) => {
        const status = displayStatus(a.status, a.publishedAt)
        return (
          <OrderChip
            kind="article"
            value={status}
            label={
              status === 'scheduled' && a.publishedAt
                ? copy.scheduledFor(fmt.pattern(a.publishedAt, { day: 'numeric', month: 'short' }))
                : copy.status[status]
            }
          />
        )
      },
    },
    {
      id: 'author',
      title: copy.columns.author,
      sortValue: (a) => a.author,
      render: (a) => a.author || <span className="text-muted-foreground">{copy.none}</span>,
    },
    {
      id: 'published',
      title: copy.columns.published,
      sortValue: (a) => (a.publishedAt ? new Date(a.publishedAt) : null),
      render: (a) =>
        a.publishedAt && displayStatus(a.status, a.publishedAt) === 'published' ? (
          fmt.pattern(a.publishedAt, { day: 'numeric', month: 'short' })
        ) : (
          <span className="text-muted-foreground">{copy.none}</span>
        ),
    },
  ]
}
