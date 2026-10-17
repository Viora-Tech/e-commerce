'use client'

import { shortLinkPath, tagSummary } from '@commerce/core/marketing'
import { ExternalLink, Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card } from '@commerce/ui/shadcn/card'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import EmptyState from '@/components/layout/empty-state'
import PageHeader from '@/components/layout/page-header'
import ResourceTable, { type ResourceColumnSpec } from '@/components/table/resource-table'
import RowMenu from '@/components/table/row-menu'
import { growthLinksContent, growthOverviewContent } from '@/data/growth'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import type { Formatters } from '@/lib/format'
import { routes } from '@/lib/routes'
import LinkDialog from './link-dialog'

type ListResult = Awaited<ReturnType<typeof api.shortLinks.list>>
type Item = ListResult['items'][number]
type Totals = Awaited<ReturnType<typeof api.shortLinks.totals>>

type LinksPageProps = { storefrontOrigin: string }

const PER_PAGE = 25

function linkColumns(
  copy: typeof growthLinksContent,
  fmt: Formatters,
  host: string,
): ResourceColumnSpec<Item>[] {
  return [
    {
      id: 'link',
      title: copy.columns.link,
      hideable: false,
      sortValue: (l) => l.name,
      align: 'start',
      className: 'w-[26%] whitespace-normal',
      render: (l) => (
        <span className="flex flex-col text-left">
          <span className="line-clamp-1 text-ink-strong">{l.name}</span>
          <span className="text-caption text-muted-foreground">{`${host}${shortLinkPath(l.slug)}`}</span>
        </span>
      ),
    },
    {
      id: 'tags',
      title: copy.columns.tags,
      align: 'start',
      className: 'w-[34%] whitespace-normal',
      render: (l) => (
        <span className="line-clamp-1 text-muted-foreground">{tagSummary(l) || copy.noTags}</span>
      ),
    },
    {
      id: 'clicks',
      title: copy.columns.clicks,
      align: 'end',
      sortValue: (l) => l.clicks,
      render: (l) => <span className="tabular-nums">{fmt.number(l.clicks)}</span>,
    },
    {
      id: 'orders',
      title: copy.columns.orders,
      align: 'end',
      sortValue: (l) => l.orders,
      render: (l) => <span className="tabular-nums">{fmt.number(l.orders)}</span>,
    },
    {
      id: 'revenue',
      title: copy.columns.revenue,
      align: 'end',
      sortValue: (l) => l.revenuePaise,
      render: (l) => <span className="tabular-nums">{fmt.money(l.revenuePaise)}</span>,
    },
    {
      id: 'created',
      title: copy.columns.created,
      sortValue: (l) => new Date(l.createdAt).getTime(),
      render: (l) => (
        <span className="text-muted-foreground tabular-nums">{fmt.day(l.createdAt)}</span>
      ),
    },
  ]
}

/**
 * Growth → Links (Figma "Marketing / Links list"): short `/l/<slug>` links with their tracking
 * tags, clicks, the orders they brought and that revenue, and New link to make one.
 */
export default function LinksPage({ storefrontOrigin }: LinksPageProps) {
  // Hooks
  const copy = useCopy(growthLinksContent)
  const overview = useCopy(growthOverviewContent)
  const fmt = useFormat()
  const [result, setResult] = useState<ListResult | null>(null)
  const [totals, setTotals] = useState<Totals | null>(null)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<Item | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Item | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  // The page of links, and the totals across all of them.
  useEffect(() => {
    if (reloadKey < 0) return
    let live = true
    api.shortLinks
      .list({ page, perPage: PER_PAGE, search: query || undefined })
      .then((r) => live && setResult(r))
    api.shortLinks.totals().then((t) => live && setTotals(t))
    return () => {
      live = false
    }
  }, [page, query, reloadKey])

  // Event handlers
  const reload = () => setReloadKey((k) => k + 1)
  const handleCopy = async (l: Item) => {
    try {
      await navigator.clipboard.writeText(`${storefrontOrigin}${shortLinkPath(l.slug)}`)
      toast.success(copy.copied)
    } catch {
      // Clipboard blocked: the short address is in the row to copy by hand.
    }
  }
  const handleSaved = () => {
    setEditing(null)
    reload()
  }
  const handleDelete = async () => {
    if (!deleting) return
    try {
      await api.shortLinks.delete({ id: deleting.id })
      toast.success(copy.deleted)
      reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setDeleting(null)
    }
  }

  // Render logic
  const host = new URL(storefrontOrigin).host
  const empty = totals !== null && totals.links === 0
  const newButton = (
    <Button onClick={() => setEditing('new')}>
      <Plus aria-hidden />
      {copy.newLink}
    </Button>
  )

  return (
    <div className="flex w-full flex-col gap-6 px-4 py-6 md:px-8 md:py-8">
      <PageHeader
        title={copy.title}
        summary={
          totals === null
            ? undefined
            : empty
              ? copy.noLinks
              : copy.summary(totals.links, fmt.number(totals.clicks), fmt.number(totals.orders))
        }
        back={{ label: overview.title, href: routes.growth.home() }}
        actions={newButton}
      />
      {empty ? (
        <Card>
          <EmptyState
            icon={ExternalLink}
            heading={copy.empty.heading}
            body={copy.empty.body}
            action={newButton}
          />
        </Card>
      ) : (
        <ResourceTable
          resourceName={copy.resource}
          columns={linkColumns(copy, fmt, host)}
          items={result?.items ?? []}
          getId={(l) => l.id}
          loading={result === null}
          selectable={false}
          query={query}
          onQueryChange={(q) => {
            setPage(1)
            setQuery(q)
          }}
          page={page}
          perPage={PER_PAGE}
          total={result?.total ?? 0}
          onPageChange={setPage}
          rowActions={(l) => (
            <RowMenu
              items={[
                { label: copy.menu.copy, onSelect: () => void handleCopy(l) },
                { label: copy.menu.edit, onSelect: () => setEditing(l) },
                { label: copy.menu.open, href: `${storefrontOrigin}${shortLinkPath(l.slug)}` },
                { label: copy.menu.delete, onSelect: () => setDeleting(l), destructive: true },
              ]}
            />
          )}
          empty={{ heading: copy.empty.heading }}
        />
      )}
      {editing ? (
        <LinkDialog
          link={editing === 'new' ? null : editing}
          origin={storefrontOrigin}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      ) : null}
      {deleting ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setDeleting(null)}
          title={copy.deleteDialog.title(deleting.name)}
          body={copy.deleteDialog.body}
          confirmLabel={copy.deleteDialog.confirm}
          cancelLabel={copy.deleteDialog.cancel}
          onConfirm={handleDelete}
        />
      ) : null}
    </div>
  )
}
