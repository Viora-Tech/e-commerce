'use client'

import { API_ACTIVITY_FILTERS, type ApiActivityFilter } from '@commerce/core/api-access'
import { cn } from '@commerce/ui/lib/utils'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { useEffect, useState } from 'react'
import KitButton from '@/components/kit/kit-button'
import DataCard from '@/components/layout/data-card'
import EmptyState from '@/components/layout/empty-state'
import { mcpContent } from '@/data/mcp'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { dayKey } from '@/lib/format-date'
import ApprovalDialog from './approval-dialog'

type Page = Awaited<ReturnType<typeof api.apiAccess.activity>>
type Item = Page['items'][number]

/** Kinds that change the store get the strong dot; reads and sign-ins a quiet one. */
const DOT: Record<Item['kind'], string> = {
  read: 'bg-muted-foreground/50',
  change: 'bg-success',
  approval: 'bg-warning',
  blocked: 'bg-danger',
  connected: 'bg-info',
  revoked: 'bg-muted-foreground/50',
  expired: 'bg-muted-foreground/50',
}

/** Figma "Settings · MCP & API · Activity log": 90 days, by day, with filters and approvals. */
export default function McpActivityTab() {
  // Hooks
  const copy = useCopy(mcpContent)
  const format = useFormat()
  const [filter, setFilter] = useState<ApiActivityFilter>('all')
  const [items, setItems] = useState<Item[] | null>(null)
  const [counts, setCounts] = useState<Page['counts'] | null>(null)
  const [next, setNext] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [approval, setApproval] = useState<string | null>(null)
  const [reload, setReload] = useState(0)

  // biome-ignore lint/correctness/useExhaustiveDependencies: `reload` re-runs it after an approval
  useEffect(() => {
    setItems(null)
    setFailed(false)
    api.apiAccess
      .activity({ filter, before: null })
      .then((page) => {
        setItems(page.items)
        setCounts(page.counts)
        setNext(page.next)
      })
      .catch(() => setFailed(true))
  }, [filter, reload])

  // Event handlers
  const handleMore = async () => {
    if (!next) return
    setLoading(true)
    try {
      const page = await api.apiAccess.activity({ filter, before: next })
      setItems((all) => [...(all ?? []), ...page.items])
      setNext(page.next)
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }

  // Render logic
  const groups: { key: string; label: string; items: Item[] }[] = []
  for (const item of items ?? []) {
    const key = dayKey(item.createdAt)
    const last = groups.at(-1)
    if (last?.key === key) last.items.push(item)
    else groups.push({ key, label: format.day(item.createdAt), items: [item] })
  }

  return (
    <DataCard title={copy.activity.heading} bodyClassName="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label={copy.activity.heading}>
        {API_ACTIVITY_FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-body transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              filter === f
                ? 'border-transparent bg-primary text-primary-foreground'
                : 'border-border bg-card text-foreground hover:bg-muted',
            )}
          >
            {copy.activity.filters[f]}
            {counts ? (
              <span
                className={cn(
                  'text-caption tabular-nums',
                  filter === f ? 'opacity-80' : 'text-muted-foreground',
                )}
              >
                {format.number(counts[f])}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {failed ? (
        <p className="text-body text-muted-foreground">{copy.activity.loadFailed}</p>
      ) : items === null ? (
        <Skeleton className="h-48 w-full rounded-xl" />
      ) : items.length === 0 ? (
        <EmptyState
          variant="dashed"
          size="sm"
          heading={copy.activity.empty}
          body={copy.activity.emptyBody}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((g) => (
            <section key={g.key} className="flex flex-col gap-1">
              <h3 className="text-caption text-muted-foreground">{g.label}</h3>
              <ol className="flex flex-col">
                {g.items.map((item) => (
                  <li key={item.id} className="flex items-start gap-3 px-1 py-2.5">
                    <span
                      aria-hidden
                      className={cn('mt-1.5 size-2 shrink-0 rounded-full', DOT[item.kind])}
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <p className="text-body break-words text-ink-strong">{item.summary}</p>
                      {item.detail || item.approvalId ? (
                        <p className="text-caption text-muted-foreground">
                          {item.detail}
                          {item.approvalId ? (
                            <>
                              {item.detail ? ' · ' : null}
                              <button
                                type="button"
                                onClick={() => setApproval(item.approvalId)}
                                className="font-medium text-link underline-offset-2 hover:underline"
                              >
                                {copy.activity.openApproval}
                              </button>
                            </>
                          ) : null}
                        </p>
                      ) : null}
                    </div>
                    <time
                      dateTime={new Date(item.createdAt).toISOString()}
                      className="shrink-0 text-caption text-muted-foreground tabular-nums"
                    >
                      {format.pattern(item.createdAt, { hour: 'numeric', minute: '2-digit' })}
                    </time>
                  </li>
                ))}
              </ol>
            </section>
          ))}
          {next ? (
            <KitButton variant="link" onClick={handleMore} disabled={loading} className="self-end">
              {loading ? copy.activity.loading : copy.activity.loadOlder}
            </KitButton>
          ) : null}
        </div>
      )}
      <ApprovalDialog
        actionId={approval}
        onClose={() => setApproval(null)}
        onChange={() => setReload((n) => n + 1)}
      />
    </DataCard>
  )
}
