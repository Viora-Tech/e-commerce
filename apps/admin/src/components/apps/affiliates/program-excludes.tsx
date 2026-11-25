'use client'

import type { ProgramRules } from '@commerce/plugin-affiliates/settings'
import { Field, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { affiliatesContent } from '@/data/affiliates'
import { useCopy } from '@/hooks/use-copy'
import TargetPicker from './target-picker'
import { idsOf, type TargetKind, withPicked } from './targets'

type ProgramExcludesProps = {
  excludes: ProgramRules['excludes']
  onChange: (excludes: ProgramRules['excludes']) => void
}

const KINDS: TargetKind[] = ['product', 'collection']

/** Products and collections that earn no commission at all, picked by name. */
export default function ProgramExcludes({ excludes, onChange }: ProgramExcludesProps) {
  // Hooks
  const { settings: copy } = useCopy(affiliatesContent)

  // Event handlers
  const handlePicked = (kind: TargetKind, ids: string[]) =>
    onChange(withPicked(excludes, kind, ids, (id) => ({ target: kind, id, label: '' })))

  // Render logic
  return (
    <FieldGroup>
      {KINDS.map((kind) => (
        <Field key={kind}>
          <FieldLabel>{copy.targetGroups[kind]}</FieldLabel>
          <TargetPicker
            kind={kind}
            ids={idsOf(excludes, kind)}
            onChange={(ids) => handlePicked(kind, ids)}
          />
        </Field>
      ))}
    </FieldGroup>
  )
}
