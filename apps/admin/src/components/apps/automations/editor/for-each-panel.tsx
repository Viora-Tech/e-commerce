'use client'

import type { FindNode, ForEachNode } from '@commerce/core/automations'
import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import { automationLoopContent } from '@/data/automations'
import { useCopy } from '@/hooks/use-copy'
import SelectInput from './select-input'

type ForEachPanelProps = {
  node: ForEachNode
  /** Find records steps above this one, nearest first. */
  sources: FindNode[]
  onChange: (node: ForEachNode) => void
}

/** For each: which Find records step's records it walks. */
export default function ForEachPanel({ node, sources, onChange }: ForEachPanelProps) {
  // Hooks
  const copy = useCopy(automationLoopContent)

  // Render logic
  const label = (f: FindNode) =>
    f.label || copy.findTitle(f.limit, copy.resources[f.resource] ?? '')

  return (
    <Field>
      <FieldLabel htmlFor={`loop-${node.id}-source`}>{copy.source}</FieldLabel>
      <SelectInput
        id={`loop-${node.id}-source`}
        value={sources.some((f) => f.id === node.source) ? node.source : null}
        placeholder={copy.noSource}
        options={sources.map((f) => ({ value: f.id, label: label(f) }))}
        onChange={(source) => onChange({ ...node, source })}
      />
      <FieldDescription>{copy.sourceHelp}</FieldDescription>
    </Field>
  )
}
