'use client'

import { permissions } from '@commerce/core/permissions'
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { Switch } from '@commerce/ui/shadcn/switch'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import EmptyState from '@/components/layout/empty-state'
import NoticeBar from '@/components/layout/notice-bar'
import PageHeader from '@/components/layout/page-header'
import SettingsCard from '@/components/settings/settings-card'
import SettingsTable from '@/components/settings/settings-table'
import SettingsTableCell from '@/components/settings/settings-table-cell'
import SettingsTableRow from '@/components/settings/settings-table-row'
import { inboxKnowledgeContent } from '@/data/inbox-knowledge'
import { useCopy } from '@/hooks/use-copy'
import { usePermissions } from '@/hooks/use-permissions'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import KnowledgeDialog, { type KnowledgeEntry } from './knowledge-dialog'

type KnowledgePageProps = {
  /** The store's AI agent answers shoppers (mode is not off). */
  aiOn: boolean
}

type KnowledgeView = {
  entries: KnowledgeEntry[]
  counts: { total: number; published: number }
  imported: { definitionId: string; entries: number; remaining: number } | null
}

/** The dialog open: a new answer, or the one being changed. */
type Editing = { entry: KnowledgeEntry | null } | null

/**
 * Sales channels › Inbox › Knowledge base: the answers the AI agent quotes, each with a publish
 * switch ("6 of 18 published"), and a one-click copy of Shopify's imported Knowledge Base Facts.
 */
export default function KnowledgePage({ aiOn }: KnowledgePageProps) {
  // Hooks
  const copy = useCopy(inboxKnowledgeContent)
  const { hasPermission } = usePermissions()
  const [view, setView] = useState<KnowledgeView | null>(null)
  const [editing, setEditing] = useState<Editing>(null)
  const [deleting, setDeleting] = useState<KnowledgeEntry | null>(null)
  const [bringing, setBringing] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    // reloadKey re-runs the fetch after a save, move, publish or delete.
    if (reloadKey < 0) return
    let live = true
    api.inbox.knowledge.list().then((v) => {
      if (live) setView(v)
    })
    return () => {
      live = false
    }
  }, [reloadKey])

  // Helpers
  const reload = () => setReloadKey((k) => k + 1)
  const fail = (err: unknown) =>
    toast.error(err instanceof Error && err.message ? err.message : copy.failed)

  // Event handlers
  const handleSaved = () => {
    setEditing(null)
    reload()
  }
  const handleMove = async (index: number, by: -1 | 1) => {
    if (!view) return
    const next = [...view.entries]
    const [moved] = next.splice(index, 1)
    if (!moved) return
    next.splice(index + by, 0, moved)
    setView({ ...view, entries: next })
    try {
      await api.inbox.knowledge.reorder({ ids: next.map((e) => e.id) })
    } catch (err) {
      fail(err)
      reload()
    }
  }
  const handlePublish = async (entry: KnowledgeEntry, published: boolean) => {
    if (!view) return
    setView({
      ...view,
      entries: view.entries.map((e) => (e.id === entry.id ? { ...e, published } : e)),
      counts: { ...view.counts, published: view.counts.published + (published ? 1 : -1) },
    })
    try {
      await api.inbox.knowledge.setPublished({ id: entry.id, published })
      toast.success(published ? copy.publishedOn : copy.publishedOff)
    } catch (err) {
      fail(err)
      reload()
    }
  }
  const handleDelete = async () => {
    if (!deleting) return
    try {
      await api.inbox.knowledge.delete({ id: deleting.id })
      toast.success(copy.deleted)
      setDeleting(null)
      reload()
    } catch (err) {
      fail(err)
      throw err
    }
  }
  const handleBringOver = async () => {
    setBringing(true)
    try {
      const result = await api.inbox.knowledge.bringOver()
      toast.success(copy.bringOver.done(result.added))
      reload()
    } catch (err) {
      fail(err)
    } finally {
      setBringing(false)
    }
  }

  // Render logic
  const canManage = hasPermission(permissions.INBOX_MANAGE)
  const entries = view?.entries ?? []
  const addButton = canManage ? (
    <Button onClick={() => setEditing({ entry: null })} disabled={!view}>
      <Plus aria-hidden="true" />
      {copy.add}
    </Button>
  ) : null
  const imported = view?.imported
  const showBringOver = canManage && imported && imported.remaining > 0

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={copy.title}
        subtitle={
          view && view.counts.total > 0
            ? `${copy.publishedOf(view.counts.published, view.counts.total)} · ${copy.subtitle}`
            : copy.subtitle
        }
        actions={addButton}
      />
      {aiOn ? null : (
        <NoticeBar
          action={
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href={routes.salesChannels.inboxSettings()} />}
            >
              {copy.aiSettings}
            </Button>
          }
        >
          {copy.aiOff}
        </NoticeBar>
      )}
      {showBringOver ? (
        <SettingsCard
          title={copy.bringOver.title}
          description={copy.bringOver.body(imported.remaining, imported.entries)}
          footer={
            <Button onClick={handleBringOver} disabled={bringing}>
              {copy.bringOver.action}
            </Button>
          }
        >
          <p className="text-body text-muted-foreground">{copy.bringOver.note}</p>
        </SettingsCard>
      ) : null}
      {!view ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : (
        <SettingsTable
          heading={copy.listTitle}
          columns={[
            { label: copy.columns.title },
            { label: copy.columns.answer, className: 'hidden md:table-cell' },
            { label: copy.columns.published, center: true },
          ]}
          actions={canManage}
          after={entries.length === 0 ? <EmptyState heading={copy.empty} /> : undefined}
        >
          {entries.map((e, i) => (
            <SettingsTableRow key={e.id}>
              <SettingsTableCell className="max-w-xs">
                <span className="flex flex-col gap-0.5">
                  <span className="truncate">{e.title}</span>
                  {e.imported ? (
                    <span className="text-caption text-muted-foreground">{copy.imported}</span>
                  ) : null}
                </span>
              </SettingsTableCell>
              <SettingsTableCell className="hidden max-w-md truncate md:table-cell">
                {e.answer}
              </SettingsTableCell>
              <SettingsTableCell className="text-center">
                <Switch
                  checked={e.published}
                  disabled={!canManage}
                  aria-label={copy.publish(e.title)}
                  onCheckedChange={(published) => handlePublish(e, published)}
                />
              </SettingsTableCell>
              {canManage ? (
                <SettingsTableCell className="text-right">
                  <span className="inline-flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={copy.moveUp}
                      disabled={i === 0}
                      onClick={() => handleMove(i, -1)}
                    >
                      <ArrowUp className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={copy.moveDown}
                      disabled={i === entries.length - 1}
                      onClick={() => handleMove(i, 1)}
                    >
                      <ArrowDown className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={copy.edit}
                      onClick={() => setEditing({ entry: e })}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={copy.delete}
                      onClick={() => setDeleting(e)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </span>
                </SettingsTableCell>
              ) : null}
            </SettingsTableRow>
          ))}
        </SettingsTable>
      )}
      {editing ? (
        <KnowledgeDialog
          entry={editing.entry}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      ) : null}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        title={copy.confirmDelete.title}
        body={copy.confirmDelete.body}
        confirmLabel={copy.confirmDelete.confirm}
        tone="destructive"
        onConfirm={handleDelete}
      />
    </div>
  )
}
