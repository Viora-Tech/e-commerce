'use client'

import type {
  AutomationPlanTier,
  CatalogueView,
  PublishIssue,
  WorkflowDefinition,
  WorkflowDetail,
} from '@commerce/core/automations'
import { useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import { automationEditorContent, automationPiecesContent } from '@/data/automations'
import { useCopy, useLocale } from '@/hooks/use-copy'
import { useWorkflowDraft } from '@/hooks/use-workflow-draft'
import { automationApi } from '@/lib/automation-api'
import { editorIssues, riskSummary } from '@/lib/automation-issues'
import { fieldLabel } from '@/lib/automation-labels'
import { nodeView } from '@/lib/automation-node-view'
import {
  type Edge,
  firstRule,
  insertStep,
  loopSourceFor,
  type NewStep,
  patchNode,
  removalCount,
  removeStep,
  subjectAt,
} from '@/lib/automation-tree'
import WorkflowCanvas from '../canvas/workflow-canvas'
import TriggerPickerDialog from '../trigger-picker-dialog'
import EditorHeader from './editor-header'
import EditorNotices from './editor-notices'
import NodePanel from './node-panel'
import PauseDialog from './pause-dialog'
import PublishDialog from './publish-dialog'
import StepPickerDialog from './step-picker-dialog'
import TestDialog from './test-dialog'

type WorkflowEditorProps = {
  workflow: WorkflowDetail
  catalogue: CatalogueView
  plan: AutomationPlanTier | null
  canEdit: boolean
  canPublish: boolean
  isOwner: boolean
}

type Dialog = 'publish' | 'test' | 'pause' | 'trigger' | null

const messageOf = (err: unknown, fallback: string) =>
  err instanceof Error && err.message ? err.message : fallback

/** The Flow-like editor: header, the canvas of steps, and the picked step's settings beside it. */
export default function WorkflowEditor({
  workflow: initial,
  catalogue,
  plan,
  canEdit,
  canPublish,
  isOwner,
}: WorkflowEditorProps) {
  // Hooks
  const copy = useCopy(automationEditorContent)
  const pieces = useCopy(automationPiecesContent)
  const locale = useLocale()
  const { def, workflow, setDef, name, setName, saveState, replace, flush } = useWorkflowDraft(
    initial,
    canEdit,
  )
  const [selected, setSelected] = useState<string | null>('trigger')
  const [inserting, setInserting] = useState<{ edge: Edge; label: string } | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  const [dialog, setDialog] = useState<Dialog>(null)
  const [tested, setTested] = useState(false)
  const [serverIssues, setServerIssues] = useState<PublishIssue[]>([])
  const [busy, setBusy] = useState(false)

  // Helpers
  const change = (next: WorkflowDefinition) => {
    setDef(next)
    setTested(false)
    setServerIssues([])
  }

  // Event handlers
  const handleInsert = (step: NewStep) => {
    if (!inserting) return
    const made = insertStep(def, inserting.edge, step)
    const at = subjectAt(def, inserting.edge, subject)
    const fields = catalogue.fields.filter((f) => f.subject === at)
    const next =
      step.kind === 'condition'
        ? patchNode(made.def, made.id, (n) =>
            n.kind === 'condition'
              ? { ...n, rules: { join: 'and', rules: [firstRule(fields)] } }
              : n,
          )
        : made.def
    change(next)
    setSelected(made.id)
    setInserting(null)
  }

  const handleRemove = (id: string) => {
    if (removalCount(def, id) > 1) return setRemoving(id)
    change(removeStep(def, id))
    setSelected('trigger')
  }

  const handlePublish = async (input: { confirmName?: string; turnOn: boolean }) => {
    setBusy(true)
    try {
      await flush()
      const result = await automationApi.publish({ id: workflow.id, ...input })
      if (!result.ok) {
        setServerIssues(result.issues)
        return
      }
      const fresh = await automationApi.get(workflow.id)
      if (fresh) replace(fresh)
      toast.success(copy.publish.published(result.version))
      setDialog(null)
    } catch (err) {
      toast.error(messageOf(err, copy.publish.failed))
    } finally {
      setBusy(false)
    }
  }

  const handleStatus = async (
    status: 'on' | 'off',
    waitingRuns: 'cancel' | 'finish' = 'finish',
  ) => {
    setBusy(true)
    try {
      replace(await automationApi.setStatus({ id: workflow.id, status, waitingRuns }))
      toast.success(status === 'on' ? copy.pause.activated : copy.pause.paused)
      setDialog(null)
    } catch (err) {
      toast.error(messageOf(err, copy.publish.failed))
    } finally {
      setBusy(false)
    }
  }

  const handleRestore = async (versionId: string, number: number) => {
    try {
      replace(await automationApi.restoreVersion({ id: workflow.id, versionId }))
      toast.success(copy.versions.restored(number))
    } catch (err) {
      toast.error(messageOf(err, copy.publish.failed))
    }
  }

  // Render logic
  const readOnly = !canEdit
  const trigger = catalogue.triggers.find((t) => t.id === def.trigger.type) ?? null
  const subject = trigger?.subject ?? 'none'
  const issues = editorIssues(def, catalogue, {
    plan,
    copy: copy.issues,
    fieldName: (f) => fieldLabel(pieces, locale, f),
  })
  const flagged = new Set(issues.map((i) => i.nodeId ?? 'trigger'))
  const risk = riskSummary(def, catalogue)
  const sensitive = risk.sensitive.map(
    (n) => nodeView(n, { catalogue, pieces, locale, copy }).title,
  )
  const unpublished =
    workflow.published === null || JSON.stringify(def) !== JSON.stringify(workflow.published)
  const ctx = {
    def,
    catalogue,
    pieces,
    locale,
    copy,
    selected,
    flagged,
    marks: null,
    readOnly,
    onSelect: setSelected,
    onInsert: (edge: Edge, label: string) => setInserting({ edge, label }),
  }

  return (
    <div className="flex flex-col gap-3">
      <EditorHeader
        workflow={workflow}
        name={name}
        saveState={saveState}
        unpublished={unpublished}
        readOnly={readOnly}
        canPublish={canPublish && (unpublished || workflow.status === 'off')}
        onName={setName}
        onTest={() => setDialog('test')}
        onPublish={() => setDialog('publish')}
        onToggle={() => (workflow.status === 'on' ? setDialog('pause') : void handleStatus('on'))}
        onRestore={(id, n) => void handleRestore(id, n)}
      />
      <EditorNotices
        readOnly={readOnly}
        growth={workflow.origin === 'growth'}
        unpublished={unpublished && workflow.published !== null}
        issues={issues}
        onShow={(nodeId) => setSelected(nodeId ?? 'trigger')}
      />
      <div className="grid min-h-[36rem] grid-cols-1 overflow-hidden rounded-xl border border-border bg-card lg:h-[calc(100dvh-13rem)] lg:grid-cols-[minmax(0,1fr)_24rem]">
        <WorkflowCanvas ctx={ctx} onRemove={handleRemove} className="min-h-[24rem]" />
        <aside
          aria-label={copy.panel.trigger}
          className="flex min-w-0 flex-col gap-3 overflow-y-auto border-border border-t p-4 lg:border-t-0 lg:border-l"
        >
          <NodePanel
            def={def}
            selected={selected}
            catalogue={catalogue}
            plan={plan}
            issues={issues}
            readOnly={readOnly}
            isOwner={isOwner}
            onChange={change}
            onRemove={handleRemove}
            onChangeTrigger={() => setDialog('trigger')}
          />
        </aside>
      </div>
      <StepPickerDialog
        open={inserting !== null}
        onOpenChange={(open) => !open && setInserting(null)}
        catalogue={catalogue}
        subject={inserting ? subjectAt(def, inserting.edge, subject) : subject}
        plan={plan}
        where={inserting?.label ?? ''}
        loopSource={inserting ? loopSourceFor(def, inserting.edge) : null}
        onPick={handleInsert}
      />
      <TriggerPickerDialog
        open={dialog === 'trigger'}
        onOpenChange={(open) => setDialog(open ? 'trigger' : null)}
        catalogue={catalogue}
        title={copy.panel.changeTrigger}
        description={copy.panel.changeTriggerBody}
        onPick={(t) => {
          change({ ...def, trigger: { type: t.id, config: {} } })
          setDialog(null)
        }}
      />
      <PublishDialog
        open={dialog === 'publish'}
        onOpenChange={(open) => setDialog(open ? 'publish' : null)}
        workflowName={name}
        sensitive={sensitive}
        asksApproval={risk.asksApproval}
        untested={!tested}
        issues={serverIssues.length > 0 ? serverIssues : issues}
        firstPublish={workflow.publishedVersion === null}
        on={workflow.status === 'on'}
        busy={busy}
        onTest={() => setDialog('test')}
        onPublish={(input) => void handlePublish(input)}
      />
      <TestDialog
        open={dialog === 'test'}
        onOpenChange={(open) => setDialog(open ? 'test' : null)}
        workflowId={workflow.id}
        def={def}
        catalogue={catalogue}
        onTested={() => setTested(true)}
      />
      <PauseDialog
        open={dialog === 'pause'}
        onOpenChange={(open) => setDialog(open ? 'pause' : null)}
        openRuns={workflow.openRuns}
        busy={busy}
        onPause={(waitingRuns) => void handleStatus('off', waitingRuns)}
      />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={copy.panel.removeTitle(removing ? removalCount(def, removing) : 1)}
        body={copy.panel.removeBody}
        confirmLabel={copy.panel.removeConfirm}
        onConfirm={() => {
          if (removing) change(removeStep(def, removing))
          setRemoving(null)
          setSelected('trigger')
        }}
      />
    </div>
  )
}
