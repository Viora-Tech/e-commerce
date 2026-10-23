'use client'

import {
  type ActionNode,
  type AutomationPlanTier,
  type CatalogueView,
  type ConditionNode,
  MAX_WAIT_MINUTES,
  MIN_WAIT_MINUTES,
  tierAllows,
  type WaitNode,
  type WorkflowDefinition,
} from '@commerce/core/automations'
import { CircleAlert, Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { automationEditorContent, automationPiecesContent } from '@/data/automations'
import { useCopy, useLocale } from '@/hooks/use-copy'
import type { EditorIssue } from '@/lib/automation-issues'
import { fieldLabel, mergeTagsFor } from '@/lib/automation-labels'
import { nodeView } from '@/lib/automation-node-view'
import { patchNode } from '@/lib/automation-tree'
import ActionPanel from './action-panel'
import ConditionPanel from './condition-panel'
import DurationInput from './duration-input'
import TriggerPanel from './trigger-panel'

type NodePanelProps = {
  def: WorkflowDefinition
  /** `'trigger'`, a node id, or null. */
  selected: string | null
  catalogue: CatalogueView
  plan: AutomationPlanTier | null
  issues: EditorIssue[]
  readOnly: boolean
  isOwner: boolean
  onChange: (def: WorkflowDefinition) => void
  onRemove: (id: string) => void
  onChangeTrigger: () => void
}

/** The right-hand panel: the picked step's settings (trigger, condition, action or wait). */
export default function NodePanel({
  def,
  selected,
  catalogue,
  plan,
  issues,
  readOnly,
  isOwner,
  onChange,
  onRemove,
  onChangeTrigger,
}: NodePanelProps) {
  // Hooks
  const copy = useCopy(automationEditorContent)
  const pieces = useCopy(automationPiecesContent)
  const locale = useLocale()

  // Early returns
  const trigger = catalogue.triggers.find((t) => t.id === def.trigger.type) ?? null
  const subject = trigger?.subject ?? 'none'
  const mergeTags = mergeTagsFor(subject, catalogue.fields)
  if (selected === 'trigger') {
    return (
      <TriggerPanel
        def={def}
        trigger={trigger}
        mergeTags={mergeTags}
        readOnly={readOnly}
        onChange={onChange}
        onChangeTrigger={onChangeTrigger}
      />
    )
  }
  const node = selected ? def.nodes[selected] : undefined
  if (!node) return <p className="text-body text-muted-foreground">{copy.panel.empty}</p>

  // Render logic
  const view = nodeView(node, { catalogue, pieces, locale, copy })
  const own = issues.filter((i) => i.nodeId === node.id)
  const action =
    node.kind === 'action' ? (catalogue.actions.find((a) => a.id === node.action) ?? null) : null
  const fields = [
    ...catalogue.fields.filter((f) => f.subject === subject),
    ...(catalogue.pluginFields[def.trigger.type] ?? []),
  ]
  // Required fields left empty, so their inputs show as invalid.
  const invalidKeys = new Set(
    (action?.configFields ?? [])
      .filter((f) =>
        own.some((i) => i.message === copy.issues.missing(fieldLabel(pieces, locale, f))),
      )
      .map((f) => f.key),
  )

  return (
    <fieldset disabled={readOnly} className="flex min-w-0 flex-col gap-4">
      <div className="flex items-start gap-2.5">
        <span
          className={`flex size-8 shrink-0 items-center justify-center rounded-md [&_svg]:size-4 ${view.tone}`}
        >
          <view.icon aria-hidden="true" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-eyebrow text-muted-foreground">{view.kind}</span>
          <h2 className="text-card-title text-ink-strong">{view.title}</h2>
        </div>
        {readOnly ? null : (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={copy.panel.remove}
            onClick={() => onRemove(node.id)}
          >
            <Trash2 />
          </Button>
        )}
      </div>
      {own.length > 0 ? (
        <ul className="flex flex-col gap-1 rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-caption text-danger">
          {own.map((i) => (
            <li key={i.message} className="flex items-center gap-1.5">
              <CircleAlert className="size-3.5 shrink-0" aria-hidden="true" />
              {i.message}
            </li>
          ))}
        </ul>
      ) : null}
      <Field>
        <FieldLabel htmlFor={`step-${node.id}-label`}>{copy.panel.label}</FieldLabel>
        <Input
          id={`step-${node.id}-label`}
          value={node.label ?? ''}
          maxLength={120}
          placeholder={copy.panel.labelHint}
          onChange={(e) =>
            onChange(patchNode(def, node.id, (n) => ({ ...n, label: e.target.value || undefined })))
          }
        />
      </Field>
      {node.kind === 'condition' ? (
        <ConditionPanel
          node={node}
          fields={fields}
          onChange={(next) => onChange(patchNode<ConditionNode>(def, node.id, () => next))}
        />
      ) : node.kind === 'wait' ? (
        <Field>
          <FieldLabel htmlFor={`step-${node.id}-wait`}>{copy.panel.wait}</FieldLabel>
          <DurationInput
            id={`step-${node.id}-wait`}
            minutes={node.minutes}
            min={MIN_WAIT_MINUTES}
            max={MAX_WAIT_MINUTES}
            onChange={(minutes) =>
              onChange(patchNode<WaitNode>(def, node.id, (n) => ({ ...n, minutes })))
            }
          />
          <FieldDescription>{copy.panel.waitHelp}</FieldDescription>
        </Field>
      ) : (
        <ActionPanel
          node={node}
          action={action}
          mergeTags={mergeTags}
          invalidKeys={invalidKeys}
          isOwner={isOwner}
          locked={action !== null && plan !== null && !tierAllows(plan, action.planTier)}
          onChange={(next) => onChange(patchNode<ActionNode>(def, node.id, () => next))}
        />
      )}
    </fieldset>
  )
}
