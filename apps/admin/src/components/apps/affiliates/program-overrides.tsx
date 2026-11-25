'use client'

import type { ProgramRules } from '@commerce/plugin-affiliates/settings'
import { Field, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import MoneyInput from '@/components/fields/money-input'
import type { PickItem } from '@/components/pickers/resource-pick-types'
import { affiliatesContent } from '@/data/affiliates'
import { useCopy } from '@/hooks/use-copy'
import TargetPicker from './target-picker'
import { idsOf, patchRow, percentToBp, type TargetKind, withPicked } from './targets'

type Override = ProgramRules['overrides'][number]

type ProgramOverridesProps = {
  overrides: ProgramRules['overrides']
  onChange: (overrides: ProgramRules['overrides']) => void
}

const KINDS: TargetKind[] = ['product', 'collection']

/** A new pick starts at the program's usual 10%. */
const fresh =
  (target: TargetKind) =>
  (id: string): Override => ({ target, id, label: '', rule: { type: 'percent', bp: 1000 } })

/** Special product commission: products or collections, picked by name, each with its own percent. */
export default function ProgramOverrides({ overrides, onChange }: ProgramOverridesProps) {
  // Hooks
  const { settings: copy } = useCopy(affiliatesContent)

  // Helpers
  const rateOf = (kind: TargetKind, id: string) => {
    const rule = overrides.find((o) => o.target === kind && o.id === id)?.rule
    return rule?.type === 'percent' ? String(rule.bp / 100) : ''
  }

  // Event handlers
  const handlePicked = (kind: TargetKind, ids: string[]) =>
    onChange(withPicked(overrides, kind, ids, fresh(kind)))
  const handleRate = (kind: TargetKind, id: string, typed: string) =>
    onChange(patchRow(overrides, kind, id, { rule: { type: 'percent', bp: percentToBp(typed) } }))

  // Render logic
  const rowExtra = (kind: TargetKind) => (item: PickItem) => (
    <MoneyInput
      value={rateOf(kind, item.id)}
      onChange={(typed) => handleRate(kind, item.id, typed)}
      currency={false}
      suffix="%"
      aria-label={copy.rateFor(item.title)}
    />
  )

  return (
    <FieldGroup>
      <p className="text-caption text-muted-foreground">{copy.overridesHelp}</p>
      {KINDS.map((kind) => (
        <Field key={kind}>
          <FieldLabel>{copy.targetGroups[kind]}</FieldLabel>
          <TargetPicker
            kind={kind}
            ids={idsOf(overrides, kind)}
            onChange={(ids) => handlePicked(kind, ids)}
            rowExtra={rowExtra(kind)}
          />
        </Field>
      ))}
    </FieldGroup>
  )
}
