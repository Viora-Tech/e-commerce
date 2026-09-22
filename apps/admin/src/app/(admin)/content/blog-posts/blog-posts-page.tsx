'use client'

import { Newspaper, Plus, SquarePlus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs'
import { Suspense, useEffect, useState } from 'react'
import { toast } from 'sonner'
import ArticleBulkActions from '@/components/blog/article-bulk-actions'
import { articleColumns } from '@/components/blog/article-columns'
import ArticleFilters from '@/components/blog/article-filters'
import ConfirmDeleteArticles from '@/components/blog/confirm-delete-articles'
import KitListPage from '@/components/kit/kit-list-page'
import PillTabs from '@/components/layout/pill-tabs'
import ResourceTable, { type AppliedFilter } from '@/components/table/resource-table'
import { ARTICLE_TABS, type ArticleTab, blogListContent as copy } from '@/data/blog'
import { api } from '@/lib/api-client'
import { LIST_PER_PAGE, type ListQuery, sameListQuery } from '@/lib/list-query'

type ListResult = Awaited<ReturnType<typeof api.blog.list>>
type Counts = Awaited<ReturnType<typeof api.blog.counts>>
type Blogs = Awaited<ReturnType<typeof api.blog.blogs>>

/** First page rendered on the server so the table never paints empty. */
export type BlogPostsInitial = {
  query: ListQuery<ArticleTab>
  result: ListResult
  counts: Counts
  blogs: Blogs
  tags: string[]
}

type Query = {
  page: number
  query: string
  status: ArticleTab | null
  blog: string | null
  tag: string | null
}

type Pending = { ids: string[]; clear: () => void }

const PER_PAGE = LIST_PER_PAGE

function listInput(q: Query) {
  return {
    page: q.page,
    perPage: PER_PAGE,
    query: q.query || undefined,
    status: q.status ?? ('all' as const),
    blogId: q.blog ?? undefined,
    tag: q.tag ?? undefined,
  }
}

function BlogPostsContent({ initial }: { initial: BlogPostsInitial }) {
  // Hooks
  const [q, setQ] = useQueryStates(
    {
      query: parseAsString.withDefault(''),
      page: parseAsInteger.withDefault(1),
      status: parseAsStringLiteral(ARTICLE_TABS),
      blog: parseAsString,
      tag: parseAsString,
    },
    { shallow: true },
  )
  const [result, setResult] = useState(initial.result)
  const [counts, setCounts] = useState(initial.counts)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState<Pending | null>(null)

  useEffect(() => {
    const same = sameListQuery({ page: q.page, query: q.query, status: q.status }, initial.query)
    if (same && !q.blog && !q.tag) {
      setResult(initial.result)
      return
    }
    let cancelled = false
    setLoading(true)
    api.blog
      .list(listInput(q))
      .then((r) => !cancelled && setResult(r))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [q, initial.query, initial.result])

  // Helpers
  const refresh = async () => {
    const [r, c] = await Promise.all([api.blog.list(listInput(q)), api.blog.counts()])
    setResult(r)
    setCounts(c)
  }

  const runBulk = async (
    { ids, clear }: Pending,
    action: (ids: string[]) => Promise<unknown>,
    message: string,
  ) => {
    setBusy(true)
    try {
      await action(ids)
      toast.success(message)
      clear()
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.bulk.failed)
    } finally {
      setBusy(false)
    }
  }

  // Event handlers
  const handleConfirmDelete = () => {
    if (!deleting) return
    setDeleting(null)
    void runBulk(
      deleting,
      (ids) => api.blog.delete({ ids }),
      copy.bulk.deleted(deleting.ids.length),
    )
  }

  // Render logic
  const blogOptions = initial.blogs.map((b) => ({ value: b.id, label: b.title }))
  const blogLabel = blogOptions.find((b) => b.value === q.blog)?.label ?? q.blog
  const applied = [
    q.blog && {
      key: 'blog',
      label: `${copy.filters.blog}: ${blogLabel}`,
      onRemove: () => setQ({ blog: null, page: 1 }),
    },
    q.tag && {
      key: 'tag',
      label: `${copy.filters.tag}: ${q.tag}`,
      onRemove: () => setQ({ tag: null, page: 1 }),
    },
  ].filter(Boolean) as AppliedFilter[]

  return (
    <KitListPage
      title={copy.heading}
      actions={
        <>
          <Button
            variant="outline"
            size="lg"
            render={<Link href="/content/blog-posts/blogs" />}
            nativeButton={false}
          >
            <Newspaper strokeWidth={1.6} />
            {copy.manageBlogs}
          </Button>
          <Button size="lg" render={<Link href="/content/blog-posts/new" />} nativeButton={false}>
            <SquarePlus strokeWidth={1.6} />
            {copy.add}
          </Button>
        </>
      }
    >
      <ResourceTable
        size="frame"
        resourceName={copy.resource}
        columns={articleColumns}
        items={result.rows}
        getId={(a) => a.id}
        href={(a) => `/content/blog-posts/${a.id}`}
        loading={loading}
        query={q.query}
        onQueryChange={(query) => setQ({ query, page: 1 })}
        onClearAll={() => setQ({ query: '', status: null, blog: null, tag: null, page: 1 })}
        filters={
          <ArticleFilters
            values={{ blog: q.blog, tag: q.tag }}
            blogs={blogOptions}
            tags={initial.tags}
            onChange={(patch) => setQ({ ...patch, page: 1 })}
            onClear={() => setQ({ blog: null, tag: null, page: 1 })}
          />
        }
        applied={applied}
        tabs={
          <PillTabs
            size="frame"
            value={q.status}
            onChange={(status) => setQ({ status, page: 1 })}
            tabs={[
              { value: null, label: copy.tabs.all, count: counts.all },
              ...ARTICLE_TABS.map((s) => ({ value: s, label: copy.tabs[s], count: counts[s] })),
            ]}
          />
        }
        page={q.page}
        perPage={PER_PAGE}
        total={result.total}
        onPageChange={(page) => setQ({ page })}
        bulkActions={(ids, clear) => (
          <ArticleBulkActions
            busy={busy}
            onPublish={() =>
              runBulk(
                { ids, clear },
                (x) => api.blog.publish({ ids: x }),
                copy.bulk.published(ids.length),
              )
            }
            onUnpublish={() =>
              runBulk(
                { ids, clear },
                (x) => api.blog.unpublish({ ids: x }),
                copy.bulk.unpublished(ids.length),
              )
            }
            onDelete={() => setDeleting({ ids, clear })}
          />
        )}
        empty={{
          heading: copy.empty.heading,
          body: copy.empty.body,
          action: (
            <Button render={<Link href="/content/blog-posts/new" />} nativeButton={false}>
              <Plus />
              {copy.add}
            </Button>
          ),
        }}
      />

      <ConfirmDeleteArticles
        count={deleting?.ids.length ?? 0}
        open={deleting !== null}
        busy={busy}
        onOpenChange={(open) => !open && setDeleting(null)}
        onConfirm={handleConfirmDelete}
      />
    </KitListPage>
  )
}

export default function BlogPostsPage({ initial }: { initial: BlogPostsInitial }) {
  return (
    <Suspense>
      <BlogPostsContent initial={initial} />
    </Suspense>
  )
}
