'use client'

import type { ConditionFieldDescriptor, ConditionNode } from '@commerce/core/automations'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { automationEditorContent } from '@/data/automations'
import { useCopy } from '@/hooks/use-copy'
import RuleGroupEditor from './rule-group-editor'

type ConditionPanelProps = {
  node: ConditionNode
  fields: ConditionFieldDescriptor[]
  onChange: (node: ConditionNode) => void
}

/** The condition builder: an All/Any group of field → operator → value rules, one nested group deep. */
export default function ConditionPanel({ node, fields, onChange }: ConditionPanelProps) {
  // Hooks
  const { condition: copy } = useCopy(automationEditorContent)

  // Render logic
  return (
    <div className="flex flex-col gap-3">
      <p className="text-caption text-muted-foreground">{copy.help}</p>
      <RuleGroupEditor
        id={`cond-${node.id}`}
        group={node.rules}
        fields={fields}
        depth={1}
        onChange={(rules) => onChange({ ...node, rules })}
      />
      {node.otherwiseStops !== undefined ? (
        <label htmlFor={`cond-${node.id}-stops`} className="flex items-center gap-2 text-body">
          <Checkbox
            id={`cond-${node.id}-stops`}
            checked={node.otherwiseStops}
            onCheckedChange={(on) => onChange({ ...node, otherwiseStops: on === true })}
          />
          {copy.otherwiseStops}
        </label>
      ) : null}
    </div>
  )
}
