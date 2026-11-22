'use client'

import type { EmailTemplateDesign } from '@commerce/notifications/design'
import { CheckIcon, RotateCcw } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import LeaveGuard from '@/components/layout/leave-guard'
import InlineState from '@/components/states/inline-state'
import { emailDesignContent } from '@/data/email-design'
import { notificationsSettingsContent } from '@/data/notifications'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import DesignEditorSidebar from './design-editor-sidebar'
import DesignPreview from './design-preview'
import { blockProblem } from './design-state'

type DesignEditorPageProps = {
  /** The message whose email is designed. */
  messageId: string
}

type Overview = Awaited<ReturnType<typeof api.notifications.design>>
type DesignId = Parameters<typeof api.notifications.design>[0]['id']

/**
 * Settings → Notifications → a message → Edit: the drag-and-drop editor for one transactional
 * email, a full page (owner, 22 Nov 2026, was a dialog). Blocks on the left (add, drag, remove,
 * change), the live preview with a sample order on the right. The order's own blocks are
 * locked: they move but never go and always show real data. Leaving with changes asks first.
 */
export default function DesignEditorPage({ messageId }: DesignEditorPageProps) {
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
    if (!design) return
    setSaving(true)
    try {
      const o = await api.notifications.saveDesign({ id: messageId as DesignId, design })
      setOverview(o)
      setDirty(false)
      toast.success(copy.editor.saved)
    } catch {
      toast.error(copy.editor.saveFailed)
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    const o = await api.notifications.resetDesign({ id: messageId as DesignId })
    setOverview(o)
    setDesign(o.defaultDesign)
    setSelected(null)
    setDirty(false)
    toast.success(copy.editor.resetDone)
  }

  // Render logic
  const name = messagesCopy.messages[messageId]?.name ?? messageId
  const pageHref = routes.settings.notification(messageId)
  const variables = overview?.variables ?? []
  const blocked = design
    ? design.blocks.some((b) => {
        const p = blockProblem(b, variables)
        return p !== null && (p.badLink || p.empty)
      })
    : true

  return (
    /* The page fills the admin's content area below the top bar; each side scrolls on its own. */
    <div className="flex min-h-[36rem] flex-col lg:h-[calc(100dvh-6.5rem)] overflow-hidden rounded-lg border border-border bg-card">
      <LeaveGuard when={dirty && !saving} />
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-2">
        <div className="min-w-0">
          <h1 className="truncate text-card-title">{copy.editor.title(name)}</h1>
          <p className="text-caption text-muted-foreground">{copy.editor.help}</p>
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
          <Button variant="ghost" size="sm" nativeButton={false} render={<Link href={pageHref} />}>
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
      ) : !design ? (
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
    </div>
  )
}
