'use client'

import { permissions } from '@commerce/core/permissions'
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import EmptyState from '@/components/layout/empty-state'
import PageHeader from '@/components/layout/page-header'
import SettingsTableCell from '@/components/settings/settings-table-cell'
import SettingsTableRow from '@/components/settings/settings-table-row'
import { inboxContent } from '@/data/inbox'
import { useCopy } from '@/hooks/use-copy'
import { useLoad } from '@/hooks/use-load'
import { usePermissions } from '@/hooks/use-permissions'
import { api } from '@/lib/api-client'
import InboxTable from './inbox-table'
import QuickReplyDialog, { type QuickReply } from './quick-reply-dialog'

/** The dialog open: a new reply, or the one being changed. */
type Editing = { reply: QuickReply | null } | null

/** Sales channels › Inbox › Quick replies: saved answers, inserted with `/shortcut` in a chat. */
export default function QuickRepliesPage() {
  // Hooks
  const copy = useCopy(inboxContent)
  const { hasPermission } = usePermissions()
  const [editing, setEditing] = useState<Editing>(null)
  const [deleting, setDeleting] = useState<QuickReply | null>(null)
  const {
    data: replies,
    setData: setReplies,
    failed,
    retry: reload,
  } = useLoad(() => api.inbox.quickReplies.list())

  // Helpers
  const fail = (err: unknown) =>
    toast.error(err instanceof Error && err.message ? err.message : copy.failed)

  // Event handlers
  const handleSaved = () => {
    setEditing(null)
    reload()
  }
  const handleMove = async (index: number, by: -1 | 1) => {
    if (!replies) return
    const next = [...replies]
    const [moved] = next.splice(index, 1)
    if (!moved) return
    next.splice(index + by, 0, moved)
    setReplies(next)
    try {
      await api.inbox.quickReplies.reorder({ ids: next.map((r) => r.id) })
    } catch (err) {
      fail(err)
      reload()
    }
  }
  const handleDelete = async () => {
    if (!deleting) return
    try {
      await api.inbox.quickReplies.delete({ id: deleting.id })
      toast.success(copy.quickReplies.deleted)
      setDeleting(null)
      reload()
    } catch (err) {
      fail(err)
      throw err
    }
  }

  // Render logic
  const q = copy.quickReplies
  const canManage = hasPermission(permissions.INBOX_MANAGE)
  const addButton = canManage ? (
    <Button onClick={() => setEditing({ reply: null })} disabled={!replies}>
      <Plus aria-hidden="true" />
      {q.add}
    </Button>
  ) : null

  return (
    <>
      <PageHeader title={q.title} subtitle={q.subtitle} actions={addButton} />
      <InboxTable
        heading={q.listTitle}
        columns={[
          { label: q.columns.shortcut },
          { label: q.columns.title },
          { label: q.columns.body, className: 'hidden md:table-cell' },
        ]}
        actions={canManage}
        loading={!replies}
        failed={failed}
        failedHeading={q.loadFailed}
        onRetry={reload}
        after={replies?.length === 0 ? <EmptyState heading={q.empty} /> : undefined}
      >
        {replies?.map((r, i) => (
          <SettingsTableRow key={r.id}>
            <SettingsTableCell>
              <code className="text-body font-mono">/{r.shortcut}</code>
            </SettingsTableCell>
            <SettingsTableCell>{r.title}</SettingsTableCell>
            <SettingsTableCell className="hidden max-w-md truncate md:table-cell">
              {r.body}
            </SettingsTableCell>
            {canManage ? (
              <SettingsTableCell className="text-right">
                <span className="inline-flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={q.moveUp}
                    disabled={i === 0}
                    onClick={() => handleMove(i, -1)}
                  >
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={q.moveDown}
                    disabled={i === (replies?.length ?? 0) - 1}
                    onClick={() => handleMove(i, 1)}
                  >
                    <ArrowDown className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={q.edit}
                    onClick={() => setEditing({ reply: r })}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={q.delete}
                    onClick={() => setDeleting(r)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </span>
              </SettingsTableCell>
            ) : null}
          </SettingsTableRow>
        ))}
      </InboxTable>
      {editing ? (
        <QuickReplyDialog
          reply={editing.reply}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      ) : null}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        title={q.confirmDelete.title}
        body={q.confirmDelete.body}
        confirmLabel={q.confirmDelete.confirm}
        tone="destructive"
        onConfirm={handleDelete}
      />
    </>
  )
}
