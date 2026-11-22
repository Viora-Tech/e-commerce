'use client'

import { siteConfig } from '@commerce/config/site'
import { EyeOff } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { type ReactNode, useEffect, useState } from 'react'
import { toast } from 'sonner'
import ResourceTable from '@/components/table/resource-table'
import RowMenu from '@/components/table/row-menu'
import { type BrokenLinkListItem, brokenLinksContent } from '@/data/broken-links'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { errorText } from '@/lib/api-errors'
import { brokenLinkColumns } from './broken-link-columns'
import RedirectDialog from './redirect-dialog'

type BrokenLinksTableProps = {
  /** The Redirects / Broken links view select. */
  views: ReactNode
  /** A redirect was created here, so the Redirects view's count is stale. */
  onRedirected: () => void
  /** The list's total, for the page summary. */
  onTotal: (total: number) => void
}

/**
 * Content › Menus › URL redirects › Broken links: the storefront's most-visited 404 paths, each
 * with the closest product or collection. Create redirect saves it through `redirects.save`
 * (the path then leaves this list); Dismiss hides it until it is visited again.
 */
export default function BrokenLinksTable({ views, onRedirected, onTotal }: BrokenLinksTableProps) {
  // Hooks
  const copy = useCopy(brokenLinksContent)
  const fmt = useFormat()
  const [data, setData] = useState<{ items: BrokenLinkListItem[]; total: number }>({
    items: [],
    total: 0,
  })
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState<number>(siteConfig.ui.rowsPerPage.default)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [choosing, setChoosing] = useState<BrokenLinkListItem | null>(null)
  const [version, setVersion] = useState(0)

  // biome-ignore lint/correctness/useExhaustiveDependencies: `version` re-runs the load after a change; `onTotal` is the parent's state setter
  useEffect(() => {
    let live = true
    setLoading(true)
    setFailed(false)
    const timer = setTimeout(() => {
      api.redirects
        .brokenLinks({ page, perPage, query: query || undefined })
        .then((next) => {
          if (!live) return
          setData(next)
          onTotal(next.total)
        })
        .catch(() => {
          if (live) setFailed(true)
        })
        .finally(() => {
          if (live) setLoading(false)
        })
    }, 200)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [page, perPage, query, version])

  // Event handlers
  const handleChanged = () => setVersion((v) => v + 1)

  const handleQuery = (next: string) => {
    setQuery(next)
    setPage(1)
  }

  const handlePerPage = (next: number) => {
    setPerPage(next)
    setPage(1)
  }

  const handleCreate = async (item: BrokenLinkListItem) => {
    if (!item.suggestion) return
    setBusyId(item.id)
    try {
      await api.redirects.save({ path: item.path, target: item.suggestion.target })
      toast.success(copy.created)
      handleChanged()
      onRedirected()
    } catch (err) {
      toast.error(errorText(err, copy.createFailed))
    } finally {
      setBusyId(null)
    }
  }

  const handleDismiss = async (ids: string[], clear: () => void) => {
    try {
      const n = await api.redirects.dismissBrokenLinks({ ids })
      toast.success(copy.dismissed(n))
      clear()
      handleChanged()
    } catch (err) {
      toast.error(errorText(err, copy.dismissFailed))
    }
  }

  const handleChosen = () => {
    handleChanged()
    onRedirected()
  }

  // Render logic
  const columns = brokenLinkColumns({
    copy,
    fmt,
    busyId,
    onCreate: handleCreate,
    onChoose: setChoosing,
  })

  return (
    <>
      <ResourceTable
        resourceName={copy.resource}
        columns={columns}
        items={data.items}
        getId={(r) => r.id}
        loading={loading}
        error={failed ? { heading: copy.loadFailed, onRetry: handleChanged } : undefined}
        views={views}
        query={query}
        onQueryChange={handleQuery}
        page={page}
        perPage={perPage}
        total={data.total}
        onPageChange={setPage}
        onPerPageChange={handlePerPage}
        selectable
        bulkActions={(ids, clear) => (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleDismiss(ids, clear)}
          >
            <EyeOff aria-hidden="true" />
            {copy.dismissSelected(ids.length)}
          </Button>
        )}
        rowActions={(r) => (
          <span className="flex items-center justify-end">
            <RowMenu
              items={[
                {
                  label: copy.dismiss,
                  icon: EyeOff,
                  onSelect: () => handleDismiss([r.id], () => {}),
                },
              ]}
            />
          </span>
        )}
        empty={
          query
            ? { heading: copy.empty.searchHeading }
            : { heading: copy.empty.heading, body: copy.empty.body }
        }
      />
      {choosing ? (
        <RedirectDialog
          redirect={null}
          initialPath={choosing.path}
          onClose={() => setChoosing(null)}
          onSaved={handleChosen}
        />
      ) : null}
    </>
  )
}
