'use client'

import type { WorkflowDetail } from '@commerce/core/automations'
import {
  ChevronLeftIcon,
  CircleAlert,
  CircleCheck,
  ClipboardList,
  Loader2Icon,
} from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import Link from 'next/link'
import StatusChip from '@/components/layout/status-chip'
import { automationEditorContent } from '@/data/automations'
import { useCopy } from '@/hooks/use-copy'
import type { DraftSaveState } from '@/hooks/use-workflow-draft'
import { automationRoutes } from '@/lib/automation-routes'
import VersionsMenu from './versions-menu'

type EditorHeaderProps = {
  workflow: WorkflowDetail
  name: string
  saveState: DraftSaveState | null
  /** The draft differs from the live version. */
  unpublished: boolean
  readOnly: boolean
  canPublish: boolean
  onName: (name: string) => void
  onTest: () => void
  onPublish: () => void
  onToggle: () => void
  onRestore: (versionId: string, number: number) => void
}

/** Editor top bar: back, name, status, save state, then Runs, Versions, Pause/Activate, Test and Publish. */
export default function EditorHeader({
  workflow,
  name,
  saveState,
  unpublished,
  readOnly,
  canPublish,
  onName,
  onTest,
  onPublish,
  onToggle,
  onRestore,
}: EditorHeaderProps) {
  // Hooks
  const copy = useCopy(automationEditorContent)

  // Render logic
  const on = workflow.status === 'on'
  const draft = workflow.publishedVersion === null
  const saveText =
    saveState === 'saving'
      ? copy.saving
      : saveState === 'failed'
        ? copy.saveFailed
        : saveState === 'saved'
          ? copy.saved
          : saveState === 'waiting'
            ? copy.savePending
            : null

  return (
    <header className="flex flex-wrap items-center gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          aria-label={copy.back}
          nativeButton={false}
          render={<Link href={automationRoutes.workflows()} />}
        >
          <ChevronLeftIcon />
        </Button>
        <Input
          value={name}
          maxLength={120}
          aria-label={copy.name}
          readOnly={readOnly}
          className="h-9 max-w-[24rem] min-w-0 border-transparent bg-transparent text-page-title shadow-none hover:border-input focus-visible:border-input"
          onChange={(e) => onName(e.target.value)}
        />
        <StatusChip tone={on ? 'success' : draft ? 'neutral' : 'attention'} variant="dot">
          {on ? copy.status.on : draft ? copy.status.draft : copy.status.off}
        </StatusChip>
        {saveText ? (
          <span
            aria-live="polite"
            className="hidden items-center gap-1 text-caption text-muted-foreground sm:inline-flex"
          >
            {saveState === 'saving' ? (
              <Loader2Icon className="size-3.5 animate-spin" aria-hidden="true" />
            ) : saveState === 'failed' ? (
              <CircleAlert className="size-3.5 text-danger" aria-hidden="true" />
            ) : (
              <CircleCheck className="size-3.5" aria-hidden="true" />
            )}
            {saveText}
          </span>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="ghost"
          nativeButton={false}
          render={<Link href={automationRoutes.workflowRuns(workflow.id)} />}
        >
          <ClipboardList aria-hidden="true" />
          {copy.actions.runs}
        </Button>
        <VersionsMenu
          workflow={workflow}
          unpublished={unpublished}
          readOnly={readOnly}
          onRestore={onRestore}
        />
        {draft || readOnly ? null : (
          <Button variant="outline" onClick={onToggle}>
            {on ? copy.actions.pause : copy.actions.activate}
          </Button>
        )}
        <Button variant="outline" onClick={onTest}>
          {copy.actions.test}
        </Button>
        {readOnly ? null : (
          <Button onClick={onPublish} disabled={!canPublish}>
            {copy.actions.publish}
          </Button>
        )}
      </div>
    </header>
  )
}
