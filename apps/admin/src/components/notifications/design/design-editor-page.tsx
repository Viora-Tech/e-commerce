'use client'

import type { EmailTemplateDesign } from '@commerce/notifications/design'
import { CheckIcon, RotateCcw } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import Link from 'next/link'
import { useEffect, useReducer, useState } from 'react'
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
import { canRedo, canUndo, historyReducer, historyShortcut, sameDesign } from './design-history'
import DesignHistoryButtons from './design-history-buttons'
import DesignPreview from './design-preview'
import DesignSettingsPanel from './design-settings-panel'
import { blockProblem, savePayload } from './design-state'

type DesignEditorPageProps = {
  /** The message whose email is designed. */
  messageId: string
}

type Overview = Awaited<ReturnType<typeof api.notifications.design>>
type DesignId = Parameters<typeof api.notifications.design>[0]['id']

/**
 * Settings → Notifications → a message → Edit: the drag-and-drop editor for one transactional
 * email, a full page (owner, 22 Nov 2026, was a dialog), laid out like Shopify's: blocks on the
 * left (drag in from the palette, drag to reorder, duplicate, remove), the live preview with a
 * sample order in the middle (desktop or phone), the selected block's settings on the right.
 * Undo and Redo cover every change. The order's own blocks are locked: they move but never go
 * and always show real data. Leaving with changes asks first.
 */
export default function DesignEditorPage({ messageId }: DesignEditorPageProps) {
  // Hooks
  const copy = useCopy(emailDesignContent)
  const messagesCopy = useCopy(notificationsSettingsContent)
  const [overview, setOverview] = useState<Overview | null>(null)
  const [history, dispatch] = useReducer(historyReducer, null)
  /** The design as the server has it, to tell whether there is anything to save. */
  const [saved, setSaved] = useState<EmailTemplateDesign | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [confirmReset, setConfirmReset] = useState(false)

  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` (Try again) re-runs the load
  useEffect(() => {
    let live = true
    setOverview(null)
    setSaved(null)
    dispatch({ type: 'clear' })
    setSelected(null)
    setFailed(false)
    api.notifications
      .design({ id: messageId as DesignId })
      .then((o) => {
        if (!live) return
        const loaded = o.design ?? o.defaultDesign
        setOverview(o)
        setSaved(loaded)
        dispatch({ type: 'load', design: loaded })
      })
      .catch(() => {
        if (live) setFailed(true)
      })
    return () => {
      live = false
    }
  }, [messageId, attempt])

  /* Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z anywhere on the page except inside a text field. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const action = historyShortcut(e)
      if (!action) return
      e.preventDefault()
      dispatch({ type: action })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Event handlers
  const handleChange = (next: EmailTemplateDesign, group?: string) => {
    dispatch({ type: 'change', design: next, group })
  }

  const handleSave = async () => {
    if (!design) return
    setSaving(true)
    try {
      const payload = savePayload(design)
      const o = await api.notifications.saveDesign({ id: messageId as DesignId, design: payload })
      setOverview(o)
      setSaved(payload)
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
    setSaved(o.defaultDesign)
    dispatch({ type: 'load', design: o.defaultDesign })
    setSelected(null)
    toast.success(copy.editor.resetDone)
  }

  // Render logic
  const design = history?.present ?? null
  const dirty = design !== null && !sameDesign(design, saved)
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
    <div className="flex min-h-[36rem] flex-col overflow-hidden rounded-lg border border-border bg-card xl:h-[calc(100dvh-6.5rem)]">
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
          <DesignHistoryButtons
            canUndo={canUndo(history)}
            canRedo={canRedo(history)}
            onUndo={() => dispatch({ type: 'undo' })}
            onRedo={() => dispatch({ type: 'redo' })}
          />
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
        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[20rem_minmax(0,1fr)] xl:grid-cols-[20rem_minmax(0,1fr)_22rem]">
          <div className="min-h-0 overflow-y-auto border-b border-border p-4 lg:border-r lg:border-b-0">
            <DesignEditorSidebar
              design={design}
              variables={variables}
              selected={selected}
              onSelect={setSelected}
              onChange={handleChange}
            />
          </div>
          {/* Below xl the settings sit under the preview; from xl they get their own column. */}
          <div className="flex min-h-0 flex-col overflow-y-auto p-4 lg:row-span-2 xl:row-span-1">
            <DesignPreview messageId={messageId} design={design} />
          </div>
          <div className="min-h-0 overflow-y-auto border-t border-border p-4 xl:border-t-0 xl:border-l">
            <DesignSettingsPanel
              design={design}
              variables={variables}
              selected={selected}
              onChange={handleChange}
              onSelect={setSelected}
            />
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
