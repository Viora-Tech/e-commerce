'use client'

import {
  AiIcon,
  BadgePercent,
  CircleAlert,
  CircleCheck,
  ExternalLink,
  FileEdit,
  InfoIcon,
  LayoutGrid,
  MessageSquare,
  SquareTerminal,
  TrendingUp,
  TriangleAlert,
} from '@commerce/ui/icons'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import KitButton from '@/components/kit/kit-button'
import StatusChip from '@/components/layout/status-chip'
import { approvalsContent } from '@/data/approvals'
import { assistantContent } from '@/data/assistant'
import type { ActionView } from '@/hooks/use-assistant'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { usePermissions } from '@/hooks/use-permissions'
import { api } from '@/lib/api-client'
import ActionDiff from './action-diff'
import ActionEditForm from './action-edit-form'

type ActionCardProps = {
  action: ActionView
  onChange: (view: ActionView) => void
}

const TOOL_ICONS: Record<string, typeof AiIcon> = {
  proposeDiscount: BadgePercent,
  proposePriceChange: TrendingUp,
  proposeCollection: LayoutGrid,
  proposeProductUpdate: FileEdit,
  proposeOrderNote: MessageSquare,
  // An admin action an MCP client asked to run (Settings → MCP & API).
  runAdminAction: SquareTerminal,
}

const BADGE: Record<string, 'attention' | 'success' | 'danger' | 'neutral'> = {
  proposed: 'attention',
  executed: 'success',
  failed: 'danger',
  cancelled: 'neutral',
  expired: 'neutral',
  undone: 'neutral',
}

/**
 * A change the assistant prepared: what it is, every value before and after, and Cancel, Edit
 * or Approve (primary, on the right). Nothing runs until Approve; the card then shows the
 * result, a link to what changed and Undo when the change can be undone.
 *
 * A change waiting in Approvals (the asker's role needs approval for it) shows who asked and
 * when; the asker can only withdraw it, anyone else who may approve sees Reject and Approve.
 */
export default function ActionCard({ action, onChange }: ActionCardProps) {
  // Hooks
  const copy = useCopy(assistantContent)
  const approvals = useCopy(approvalsContent)
  const fmt = useFormat()
  const { member } = usePermissions()
  const router = useRouter()
  const [busy, setBusy] = useState<'approve' | 'edit' | 'cancel' | 'undo' | null>(null)
  const [editing, setEditing] = useState(false)

  // Helpers
  const run = async (kind: NonNullable<typeof busy>, work: () => Promise<ActionView>) => {
    setBusy(kind)
    try {
      const view = await work()
      onChange(view)
      setEditing(false)
      if (view.status === 'failed') toast.error(view.error ?? copy.card.failed)
      // Approve on a change the member's role sends for approval: it went to Approvals.
      if (kind === 'approve' && view.status === 'proposed' && view.needsApprover) {
        toast.info(approvals.sent)
      }
      // The page behind the bar shows the change (a new discount in the list, new prices).
      if (view.status === 'executed' || view.status === 'undone') router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.card.failed)
    } finally {
      setBusy(null)
    }
  }

  // Event handlers
  const handleApprove = () => run('approve', () => api.ai.approveAction({ id: action.id }))
  const handleCancel = () => run('cancel', () => api.ai.cancelAction({ id: action.id }))
  const handleUndo = () => run('undo', () => api.ai.undoAction({ id: action.id }))
  const handleSave = (changes: Record<string, string | number | null>) =>
    run('edit', () => api.ai.reviseAction({ id: action.id, changes }))

  // Render logic
  const Icon = TOOL_ICONS[action.tool] ?? AiIcon
  const open = action.status === 'proposed'
  const quiet = action.status === 'cancelled' || action.status === 'expired'
  const asker = member?.userId === action.requestedById
  const waitsForOther = open && action.needsApprover && asker
  const showAsker = action.requestedBy && (action.source === 'mcp' || action.needsApprover)

  return (
    <article
      className={`flex flex-col overflow-hidden rounded-xl border bg-card shadow-xs ${open ? 'border-border-strong' : 'border-border'} ${quiet ? 'opacity-70' : ''}`}
    >
      <header className="flex items-start gap-3 px-4 pt-3.5 pb-3">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Icon className="size-4 text-ink-strong" aria-hidden="true" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 className="text-body font-semibold break-words text-ink-strong">
            {action.preview.title}
          </h3>
          {open ? (
            <p className="text-caption text-muted-foreground">
              {action.preview.undoable ? copy.card.willUndo : copy.card.noUndo}
            </p>
          ) : null}
          {showAsker && action.requestedBy ? (
            <p className="text-caption text-muted-foreground">
              {[
                approvals.askedBy(action.requestedBy, fmt.when(action.createdAt)),
                approvals.sources[action.source] ?? action.source,
              ].join(' · ')}
            </p>
          ) : null}
        </div>
        <StatusChip tone={BADGE[action.status] ?? 'neutral'}>
          {copy.card.status[action.status] ?? action.status}
        </StatusChip>
      </header>

      {action.flagged && open ? (
        <p className="mx-4 mb-3 flex gap-2 rounded-lg bg-warning/15 px-3 py-2 text-caption text-warning-foreground dark:text-warning">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {copy.card.flagged}
        </p>
      ) : null}

      <div className="px-4 pb-3.5">
        {editing && open ? (
          <ActionEditForm
            fields={action.editable}
            busy={busy !== null}
            onSave={handleSave}
            onBack={() => setEditing(false)}
          />
        ) : (
          <ActionDiff preview={action.preview} />
        )}
        {action.preview.notes.length && !editing ? (
          <ul className="mt-3 flex flex-col gap-1">
            {action.preview.notes.map((note) => (
              <li key={note} className="flex gap-1.5 text-caption text-muted-foreground">
                <InfoIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                {note}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {waitsForOther && !editing ? (
        <footer className="flex flex-wrap items-center justify-end gap-2 border-border border-t bg-muted/30 px-4 py-2.5">
          <span className="mr-auto text-caption text-muted-foreground">
            {copy.card.waitingForOther}
          </span>
          <KitButton variant="link" onClick={handleCancel} disabled={busy !== null}>
            {busy === 'cancel' ? <Spinner /> : null}
            {copy.card.withdraw}
          </KitButton>
        </footer>
      ) : null}

      {open && !editing && !waitsForOther ? (
        <footer className="flex flex-wrap items-center justify-end gap-2 border-border border-t bg-muted/30 px-4 py-2.5">
          <KitButton variant="link" onClick={handleCancel} disabled={busy !== null}>
            {action.needsApprover ? copy.card.reject : copy.card.cancel}
          </KitButton>
          {action.editable.length && !action.needsApprover ? (
            <KitButton
              variant="secondary"
              onClick={() => setEditing(true)}
              disabled={busy !== null}
            >
              {copy.card.edit}
            </KitButton>
          ) : null}
          <KitButton variant="primary" onClick={handleApprove} disabled={busy !== null}>
            {busy === 'approve' ? <Spinner /> : null}
            {copy.card.approve}
          </KitButton>
        </footer>
      ) : null}

      {action.status === 'executed' || action.status === 'undone' ? (
        <footer className="flex flex-wrap items-center gap-x-3 gap-y-2 border-border border-t bg-muted/30 px-4 py-2.5 text-caption">
          <span className="flex min-w-0 flex-1 items-center gap-1.5 font-medium text-ink-strong">
            <CircleCheck
              className={`size-4 shrink-0 ${action.status === 'executed' ? 'text-success' : 'text-muted-foreground'}`}
              aria-hidden="true"
            />
            {action.status === 'undone' ? action.undoMessage : action.message}
          </span>
          {action.href && action.status === 'executed' ? (
            <KitButton variant="linkSm" href={action.href}>
              {copy.card.open}
              <ExternalLink className="size-3" aria-hidden="true" />
            </KitButton>
          ) : null}
          {action.canUndo ? (
            <KitButton variant="pill" onClick={handleUndo} disabled={busy !== null}>
              {busy === 'undo' ? <Spinner /> : null}
              {copy.card.undo}
            </KitButton>
          ) : null}
        </footer>
      ) : null}

      {action.status === 'expired' ? (
        <footer className="flex items-center gap-1.5 border-border border-t bg-muted/30 px-4 py-2.5 text-caption text-muted-foreground">
          <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
          {copy.card.expired}
        </footer>
      ) : null}

      {action.status === 'failed' ? (
        <footer className="flex items-center gap-1.5 border-border border-t bg-destructive/5 px-4 py-2.5 text-caption text-destructive">
          <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
          {action.error ?? copy.card.failed}
        </footer>
      ) : null}
    </article>
  )
}
