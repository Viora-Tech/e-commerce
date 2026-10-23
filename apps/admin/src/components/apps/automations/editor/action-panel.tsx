'use client'

import { type ActionNode, type ActionView, nodeNeedsApproval } from '@commerce/core/automations'
import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import { Switch } from '@commerce/ui/shadcn/switch'
import { automationEditorContent } from '@/data/automations'
import { useCopy } from '@/hooks/use-copy'
import FieldInput from './field-input'
import SelectInput from './select-input'

type ActionPanelProps = {
  node: ActionNode
  action: ActionView | null
  mergeTags: string[]
  /** Config keys the issues list flags (required and empty). */
  invalidKeys: ReadonlySet<string>
  /** The member is the store owner (may switch "Ask before running" off on owner-only actions). */
  isOwner: boolean
  locked: boolean
  onChange: (node: ActionNode) => void
}

/** An action's form, drawn from its FieldSpecs, then failure handling and "Ask before running". */
export default function ActionPanel({
  node,
  action,
  mergeTags,
  invalidKeys,
  isOwner,
  locked,
  onChange,
}: ActionPanelProps) {
  // Hooks
  const { panel: copy } = useCopy(automationEditorContent)

  // Early returns
  if (!action) return null

  // Render logic
  const asks = nodeNeedsApproval(action, node.needsApproval)
  const askLocked = action.approvalOwnerOnly && asks && !isOwner

  return (
    <div className="flex flex-col gap-4">
      {locked ? <p className="text-caption text-danger">{copy.planNote}</p> : null}
      {action.risk === 'sensitive' ? (
        <p className="text-caption text-muted-foreground">{copy.sensitiveNote}</p>
      ) : null}
      {action.risk === 'customer' ? (
        <p className="text-caption text-muted-foreground">{copy.messagesNote}</p>
      ) : null}
      {action.configFields.map((spec) => (
        <FieldInput
          key={spec.key}
          idPrefix={`step-${node.id}`}
          spec={spec}
          config={node.config}
          mergeTags={mergeTags}
          invalid={invalidKeys.has(spec.key)}
          onPatch={(patch) => onChange({ ...node, config: { ...node.config, ...patch } })}
        />
      ))}
      <Field>
        <FieldLabel htmlFor={`step-${node.id}-onError`}>{copy.onError}</FieldLabel>
        <SelectInput
          id={`step-${node.id}-onError`}
          value={node.onError}
          options={[
            { value: 'stop', label: copy.onErrorStop },
            { value: 'continue', label: copy.onErrorContinue },
          ]}
          onChange={(v) => onChange({ ...node, onError: v as ActionNode['onError'] })}
        />
      </Field>
      <Field>
        <label
          htmlFor={`step-${node.id}-ask`}
          className="flex items-center justify-between gap-3 text-body"
        >
          <span>{copy.askFirst}</span>
          <Switch
            id={`step-${node.id}-ask`}
            checked={asks}
            disabled={askLocked}
            onCheckedChange={(on) => onChange({ ...node, needsApproval: on })}
          />
        </label>
        <FieldDescription>{askLocked ? copy.askFirstOwner : copy.askFirstHelp}</FieldDescription>
      </Field>
    </div>
  )
}
