'use client'

import { siteConfig } from '@commerce/config/site'
import { Pencil } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Kbd } from '@commerce/ui/shadcn/kbd'
import { Tooltip, TooltipContent, TooltipTrigger } from '@commerce/ui/shadcn/tooltip'
import Link from 'next/link'
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs'
import { Suspense, useEffect, useState } from 'react'
import { toast } from 'sonner'
import ArticleBulkActions from '@/components/blog/article-bulk-actions'
import { articleColumns } from '@/components/blog/article-columns'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import ProoflyListPage from '@/components/layout/proofly-list-page'
import {
  appliedFromGroups,
  clearGroups,
  FILTER_PANEL_CLASS,
  type FilterGroup,
  FilterPanel,
} from '@/components/table/filter-panel'
import ResourceTable from '@/components/table/resource-table'
import ViewSelect from '@/components/table/view-select'
import { ARTICLE_TABS, type ArticleTab, blogListContent } from '@/data/blog'
import { filterPanelContent } from '@/data/filter-panel'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { type ListQuery, sameListQuery } from '@/lib/list-query'
import { usePrimaryAction } from '@/lib/primary-action'
import { routes } from '@/lib/routes'

type ListResult = Awaited<ReturnType<typeof api.blog.list>>
type Counts = Awaited<ReturnType<typeof api.blog.counts>>
type Blogs = Awaited<ReturnType<typeof api.blog.blogs>>

/** First page rendered on the server so the table never paints empty. */
export type BlogPostsInitial = {
  query: ListQuery<ArticleTab>
  perPage: number
  result: ListResult
  counts: Counts
  blogs: Blogs
  tags: string[]
}

type Query = {
  page: number
  perPage: number
  query: string
  status: ArticleTab | null
  blog: string | null
  tag: string | null
}

type Pending = { ids: string[]; clear: () => void }

function listInput(q: Query) {
  return {
    page: q.page,
    perPage: q.perPage,
    query: q.query || undefined,
    status: q.status ?? ('all' as const),
    blogId: q.blog ?? undefined,
    tag: q.tag ?? undefined,
  }
}

function BlogPostsContent({ initial }: { initial: BlogPostsInitial }) {
  // Hooks
  const copy = useCopy(blogListContent)
  const panelCopy = useCopy(filterPanelContent)
  const fmt = useFormat()
  usePrimaryAction(routes.content.newBlogPost())
  const [q, setQ] = useQueryStates(
    {
      query: parseAsString.withDefault(''),
      page: parseAsInteger.withDefault(1),
      perPage: parseAsInteger.withDefault(siteConfig.ui.rowsPerPage.default),
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
    const same =
      sameListQuery({ page: q.page, query: q.query, status: q.status }, initial.query) &&
      q.perPage === initial.perPage
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
  }, [q, initial.query, initial.perPage, initial.result])

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
  const groups: FilterGroup[] = [
    {
      key: 'blog',
      label: copy.filters.blog,
      type: 'select',
      options: blogOptions,
      value: q.blog,
      onChange: (blog) => setQ({ blog, page: 1 }),
      anyLabel: copy.filters.any,
    },
    {
      key: 'tag',
      label: copy.filters.tag,
      type: 'select',
      options: initial.tags.map((t) => ({ value: t, label: t })),
      value: q.tag,
      onChange: (tag) => setQ({ tag, page: 1 }),
      anyLabel: copy.filters.any,
    },
  ]

  return (
    <ProoflyListPage
      title={copy.heading}
      summary={copy.summary(counts.all, counts.published, counts.scheduled, counts.draft)}
      actions={
        <>
          <Button
            variant="key-neutral"
            nativeButton={false}
            render={<Link href={routes.content.blogs()} />}
          >
            {copy.manageBlogs}
          </Button>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button nativeButton={false} render={<Link href={routes.content.newBlogPost()} />}>
                  <Pencil strokeWidth={1.6} />
                  {copy.add}
                </Button>
              }
            />
            <TooltipContent>
              {copy.add} <Kbd>N</Kbd>
            </TooltipContent>
          </Tooltip>
        </>
      }
    >
      <ResourceTable
        resourceName={copy.resource}
        columns={articleColumns(copy, fmt)}
        items={result.rows}
        getId={(a) => a.id}
        href={(a) => routes.content.blogPost(a.id)}
        loading={loading}
        query={q.query}
        onQueryChange={(query) => setQ({ query, page: 1 })}
        onClearAll={() => setQ({ query: '', status: null, blog: null, tag: null, page: 1 })}
        filters={(close) => (
          <FilterPanel
            groups={groups}
            onClear={() => clearGroups(groups)}
            footer={{ label: panelCopy.show(result.total), onDone: close }}
          />
        )}
        filtersClassName={FILTER_PANEL_CLASS}
        applied={appliedFromGroups(groups, panelCopy)}
        views={
          <ViewSelect
            value={q.status}
            onChange={(status) => setQ({ status, page: 1 })}
            options={[
              { value: null, label: copy.tabs.all, count: counts.all },
              ...ARTICLE_TABS.map((s) => ({ value: s, label: copy.tabs[s], count: counts[s] })),
            ]}
          />
        }
        page={q.page}
        perPage={q.perPage}
        total={result.total}
        onPageChange={(page) => setQ({ page })}
        onPerPageChange={(perPage) => setQ({ perPage, page: 1 })}
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
            <Button nativeButton={false} render={<Link href={routes.content.newBlogPost()} />}>
              <Pencil strokeWidth={1.6} />
              {copy.add}
            </Button>
          ),
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={copy.bulk.confirmDelete.title(deleting?.ids.length ?? 0)}
        body={copy.bulk.confirmDelete.body}
        confirmLabel={copy.bulk.confirmDelete.confirm}
        cancelLabel={copy.bulk.confirmDelete.cancel}
        busy={busy}
        onConfirm={handleConfirmDelete}
      />
    </ProoflyListPage>
  )
}

export default function BlogPostsPage({ initial }: { initial: BlogPostsInitial }) {
  return (
    <Suspense>
      <BlogPostsContent initial={initial} />
    </Suspense>
  )
}
