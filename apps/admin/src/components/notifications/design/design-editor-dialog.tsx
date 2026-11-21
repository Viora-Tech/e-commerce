'use client'

import type { EmailTemplateDesign } from '@commerce/notifications/design'
import { CheckIcon, RotateCcw } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Dialog, DialogDescription, DialogTitle } from '@commerce/ui/shadcn/dialog'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import DialogContent from '@/components/layout/dialog-content'
import InlineState from '@/components/states/inline-state'
import { emailDesignContent } from '@/data/email-design'
import { notificationsSettingsContent } from '@/data/notifications'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import DesignEditorSidebar from './design-editor-sidebar'
import DesignPreview from './design-preview'
import { blockProblem } from './design-state'

type DesignEditorDialogProps = {
  /** The message to design; null closes the dialog. */
  messageId: string | null
  onClose: () => void
  /** After a save or a reset: whether the email now has its own design. */
  onSaved: (id: string, designed: boolean) => void
}

type Overview = Awaited<ReturnType<typeof api.notifications.design>>
type DesignId = Parameters<typeof api.notifications.design>[0]['id']

/**
 * Settings → Notifications → Edit design: the drag-and-drop editor for one transactional email.
 * Blocks on the left (add, drag, remove, change), the live preview with a sample order on the
 * right. The order's own blocks are locked: they move but never go and always show real data.
 */
export default function DesignEditorDialog({
  messageId,
  onClose,
  onSaved,
}: DesignEditorDialogProps) {
  // Hooks
  const copy = useCopy(emailDesignContent)
  const messagesCopy = useCopy(notificationsSettingsContent)
  const [overview, setOverview] = useState<Overview | null>(null)
  const [design, setDesign] = useState<EmailTemplateDesign | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [confirmReset, setConfirmReset] = useState(false)

  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` (Try again) re-runs the load
  useEffect(() => {
    if (!messageId) return
    let live = true
    setOverview(null)
    setDesign(null)
    setSelected(null)
    setDirty(false)
    setFailed(false)
    api.notifications
      .design({ id: messageId as DesignId })
      .then((o) => {
        if (!live) return
        setOverview(o)
        setDesign(o.design ?? o.defaultDesign)
      })
      .catch(() => {
        if (live) setFailed(true)
      })
    return () => {
      live = false
    }
  }, [messageId, attempt])

  // Event handlers
  const handleChange = (next: EmailTemplateDesign) => {
    setDesign(next)
    setDirty(true)
  }

  const handleSave = async () => {
    if (!messageId || !design) return
    setSaving(true)
    try {
      const o = await api.notifications.saveDesign({ id: messageId as DesignId, design })
      setOverview(o)
      setDirty(false)
      onSaved(messageId, true)
      toast.success(copy.editor.saved)
    } catch {
      toast.error(copy.editor.saveFailed)
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    if (!messageId) return
    const o = await api.notifications.resetDesign({ id: messageId as DesignId })
    setOverview(o)
    setDesign(o.defaultDesign)
    setSelected(null)
    setDirty(false)
    onSaved(messageId, false)
    toast.success(copy.editor.resetDone)
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) onClose()
  }

  // Render logic
  const name = messageId ? (messagesCopy.messages[messageId]?.name ?? messageId) : ''
  const variables = overview?.variables ?? []
  const blocked = design
    ? design.blocks.some((b) => {
        const p = blockProblem(b, variables)
        return p !== null && (p.badLink || p.empty)
      })
    : true

  return (
    <Dialog open={messageId !== null} onOpenChange={handleOpenChange}>
      <DialogContent size="full" panel dirty={dirty} busy={saving}>
        {/* pr-12 leaves room for the dialog's X. */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-2 pr-12 pl-4">
          <div className="min-w-0">
            <DialogTitle className="truncate text-card-title">
              {copy.editor.title(name)}
            </DialogTitle>
            <DialogDescription className="text-caption">{copy.editor.help}</DialogDescription>
          </div>
          <div className="flex items-center gap-2">
            {dirty ? (
              <span className="text-caption text-muted-foreground">{copy.editor.unsaved}</span>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              disabled={!overview?.design}
              onClick={() => setConfirmReset(true)}
            >
              <RotateCcw aria-hidden="true" />
              {copy.editor.reset}
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              {copy.editor.cancel}
            </Button>
            <Button size="sm" loading={saving} disabled={blocked || saving} onClick={handleSave}>
              <CheckIcon aria-hidden="true" />
              {saving ? copy.editor.saving : copy.editor.save}
            </Button>
          </div>
        </div>
        {failed ? (
          <div className="flex flex-1 items-center justify-center">
            <InlineState
              kind="error"
              heading={copy.editor.loadFailed}
              onRetry={() => setAttempt((n) => n + 1)}
            />
          </div>
        ) : !design || !messageId ? (
          <div className="flex flex-1 items-center justify-center gap-2 text-body text-muted-foreground">
            <Spinner />
            {copy.editor.loading}
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[24rem_1fr]">
            <div className="min-h-0 overflow-y-auto border-border p-4 lg:border-r">
              <DesignEditorSidebar
                design={design}
                variables={variables}
                selected={selected}
                onSelect={setSelected}
                onChange={handleChange}
              />
            </div>
            <div className="flex min-h-0 flex-col overflow-y-auto p-4">
              <DesignPreview messageId={messageId} design={design} />
            </div>
          </div>
        )}
        <ConfirmDialog
          open={confirmReset}
          onOpenChange={setConfirmReset}
          title={copy.editor.resetTitle}
          body={copy.editor.resetBody}
          confirmLabel={copy.editor.resetConfirm}
          cancelLabel={copy.editor.resetKeep}
          tone="destructive"
          onConfirm={handleReset}
        />
      </DialogContent>
    </Dialog>
  )
}
